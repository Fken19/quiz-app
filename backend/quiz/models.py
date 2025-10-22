"""Application data models aligned with the unified quiz schema specification."""

from __future__ import annotations

import hashlib
import unicodedata
import uuid
from typing import Optional

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
from django.db.models import F, Q
from django.db.models.functions import Lower
from django.utils import timezone


# ---------------------------------------------------------------------------
# 共通ベース
# ---------------------------------------------------------------------------


class CreatedUpdatedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


# ---------------------------------------------------------------------------
# カスタム UserManager（OAuth 前提）
# ---------------------------------------------------------------------------


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(
        self,
        email: str,
        oauth_provider: str,
        oauth_sub: str,
        password: Optional[str],
        **extra_fields,
    ):
        if not email:
            raise ValueError("Email must be provided")
        if not oauth_sub:
            raise ValueError("oauth_sub must be provided")

        email_normalized = self.normalize_email(email)
        user = self.model(
            email=email_normalized,
            oauth_provider=oauth_provider or "google",
            oauth_sub=oauth_sub,
            **extra_fields,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(
        self,
        email: str,
        password: Optional[str] = None,
        oauth_provider: str = "google",
        oauth_sub: str = "",
        **extra_fields,
    ):
        return self._create_user(email, oauth_provider, oauth_sub, password, **extra_fields)

    def create_superuser(
        self,
        email: str,
        password: str,
        oauth_provider: str = "google",
        oauth_sub: str = "superuser",
        **extra_fields,
    ):
        # Django管理画面用のスーパーユーザー作成
        # ホワイトリストへの登録は別途手動で行う必要がある
        return self._create_user(email, oauth_provider, oauth_sub, password, **extra_fields)


# ---------------------------------------------------------------------------
# アカウント / プロフィール / 講師認可
# ---------------------------------------------------------------------------


class User(AbstractBaseUser, CreatedUpdatedModel):
    """
    生徒アカウント（OAuth認証ベース）
    
    注意: PermissionsMixinを継承しない独自実装
    - is_superuser, is_staff フィールドは持たない
    - Django管理画面へのアクセス制御は別途実装
    - 講師権限はteachers_whitelistsテーブルで厳密に管理
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="user_id")
    email = models.EmailField(max_length=255)  # unique制約はMetaで部分一意として定義
    oauth_provider = models.CharField(max_length=32, default="google")
    oauth_sub = models.CharField(max_length=255)
    disabled_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    is_active = models.BooleanField(default=True)

    # usernameフィールド（Django管理画面互換の内部フィールド）
    # 設計書には明示されていないが、Django管理画面との互換性のため保持
    username = models.CharField(max_length=150, unique=True, blank=True, null=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["oauth_sub"]

    class Meta:
        db_table = "users"
        constraints = [
            models.UniqueConstraint(
                fields=["oauth_provider", "oauth_sub"],
                name="users_oauth_uniq",
            ),
            models.UniqueConstraint(
                Lower("email"),
                condition=Q(deleted_at__isnull=True),
                name="users_email_active_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["email"], name="users_email_idx"),
            models.Index(fields=["oauth_provider"], name="users_oauth_idx"),
            models.Index(fields=["disabled_at"], name="users_disabled_idx"),
            models.Index(fields=["deleted_at"], name="users_deleted_idx"),
            models.Index(fields=["last_login"], name="users_lastlogin_idx"),
        ]

    def save(self, *args, **kwargs):  # type: ignore[override]
        if self.email:
            self.email = self.__class__.objects.normalize_email(self.email)
        # usernameが未設定の場合、emailから生成
        if not self.username:
            self.username = self.email.split('@')[0] + '_' + str(uuid.uuid4())[:8]
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.email

    # Django管理画面互換メソッド（PermissionsMixinの代替）
    def has_perm(self, perm, obj=None):
        """
        ユーザーが特定の権限を持っているかチェック
        ホワイトリスト登録されている場合はTrueを返す
        """
        from .utils import is_teacher_whitelisted
        return self.is_active and is_teacher_whitelisted(self.email)

    def has_perms(self, perm_list, obj=None):
        """複数の権限をチェック"""
        return all(self.has_perm(perm, obj) for perm in perm_list)

    def has_module_perms(self, app_label):
        """アプリケーションへのアクセス権をチェック"""
        from .utils import is_teacher_whitelisted
        return self.is_active and is_teacher_whitelisted(self.email)

    @property
    def is_staff(self):
        """Django管理画面アクセス判定（ホワイトリストベース）"""
        from .utils import is_teacher_whitelisted
        return is_teacher_whitelisted(self.email)

    @property
    def is_superuser(self):
        """スーパーユーザー判定（常にFalse）"""
        return False


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name="profile")
    display_name = models.CharField(max_length=120)
    avatar_url = models.TextField()
    grade = models.CharField(max_length=32, null=True, blank=True)
    self_intro = models.TextField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "users_profile"

    def __str__(self) -> str:
        return f"Profile<{self.display_name}>"


class Teacher(CreatedUpdatedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="teacher_id")
    email = models.EmailField(max_length=255)
    oauth_provider = models.CharField(max_length=32, default="google")
    oauth_sub = models.CharField(max_length=255)
    last_login = models.DateTimeField(null=True, blank=True)
    disabled_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "teachers"
        constraints = [
            models.UniqueConstraint(
                Lower("email"),
                condition=Q(deleted_at__isnull=True),
                name="teachers_email_active_uniq",
            ),
            models.UniqueConstraint(
                fields=["oauth_provider", "oauth_sub"],
                name="teachers_oauth_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["email"], name="teachers_email_idx"),
            models.Index(fields=["oauth_provider"], name="teachers_oauth_idx"),
            models.Index(fields=["disabled_at"], name="teachers_disabled_idx"),
            models.Index(fields=["deleted_at"], name="teachers_deleted_idx"),
            models.Index(fields=["last_login"], name="teachers_lastlogin_idx"),
        ]

    def save(self, *args, **kwargs):  # type: ignore[override]
        if self.email:
            self.email = self.email.strip().lower()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.email


class TeacherProfile(models.Model):
    teacher = models.OneToOneField(Teacher, on_delete=models.CASCADE, primary_key=True, related_name="profile")
    display_name = models.CharField(max_length=120, null=True, blank=True)
    affiliation = models.CharField(max_length=120, null=True, blank=True)
    avatar_url = models.TextField(null=True, blank=True)
    bio = models.TextField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "teachers_profile"

    def __str__(self) -> str:
        return self.display_name or self.teacher.email


class TeacherWhitelist(CreatedUpdatedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="teachers_whitelist_id")
    email = models.EmailField(max_length=255)
    can_publish_vocab = models.BooleanField(default=False)
    note = models.CharField(max_length=200, null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_whitelists")

    class Meta:
        db_table = "teachers_whitelists"
        constraints = [
            models.UniqueConstraint(
                Lower("email"),
                condition=Q(revoked_at__isnull=True),
                name="tw_email_active_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["email"], name="tw_email_idx"),
            models.Index(fields=["can_publish_vocab"], name="tw_publish_idx"),
            models.Index(fields=["revoked_at"], name="tw_revoked_idx"),
        ]

    def save(self, *args, **kwargs):  # type: ignore[override]
        if self.email:
            self.email = self.email.strip().lower()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.email


class InvitationCode(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="invitation_code_id")
    invitation_code = models.CharField(max_length=24, unique=True)
    issued_by = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name="issued_invitation_codes")
    issued_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    used_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="used_invitation_codes")
    used_at = models.DateTimeField(null=True, blank=True)
    revoked = models.BooleanField(default=False)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "invitation_codes"
        indexes = [
            models.Index(fields=["invitation_code"], name="inv_codes_code_idx"),
            models.Index(fields=["issued_at"], name="inv_codes_issued_idx"),
            models.Index(fields=["expires_at"], name="inv_codes_exp_idx"),
            models.Index(fields=["used_at"], name="inv_codes_used_idx"),
        ]

    def __str__(self) -> str:
        return self.invitation_code


class LinkStatus(models.TextChoices):
    PENDING = "pending", "pending"
    ACTIVE = "active", "active"
    REVOKED = "revoked", "revoked"


class StudentTeacherLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="student_teacher_link_id")
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name="student_links")
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="teacher_links")
    status = models.CharField(max_length=16, choices=LinkStatus.choices, default=LinkStatus.ACTIVE)
    linked_at = models.DateTimeField(default=timezone.now)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by_teacher = models.ForeignKey(
        Teacher,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="revoked_links",
    )
    revoked_by_student = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="revoked_teacher_links",
    )
    invitation = models.ForeignKey(
        InvitationCode,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_teacher_links",
    )
    custom_display_name = models.CharField(max_length=120, null=True, blank=True)
    private_note = models.TextField(null=True, blank=True)
    local_student_code = models.CharField(max_length=64, null=True, blank=True)
    tags = models.JSONField(default=list, null=True, blank=True)
    kana_for_sort = models.CharField(max_length=160, null=True, blank=True)
    color = models.CharField(max_length=7, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "student_teacher_links"
        constraints = [
            models.UniqueConstraint(
                fields=["teacher", "student"],
                name="st_links_unique_pair",
            ),
            models.CheckConstraint(
                check=
                (
                    Q(revoked_at__isnull=True)
                    & Q(revoked_by_teacher__isnull=True)
                    & Q(revoked_by_student__isnull=True)
                )
                |
                (
                    Q(revoked_at__isnull=False)
                    & (
                        (Q(revoked_by_teacher__isnull=False) & Q(revoked_by_student__isnull=True))
                        | (Q(revoked_by_teacher__isnull=True) & Q(revoked_by_student__isnull=False))
                    )
                ),
                name="st_links_revoked_check",
            ),
        ]
        indexes = [
            models.Index(fields=["teacher", "status"], name="st_links_teacher_idx"),
            models.Index(fields=["student", "status"], name="st_links_student_idx"),
            models.Index(fields=["linked_at"], name="st_links_linked_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.teacher.email} -> {self.student.email} ({self.status})"


# ---------------------------------------------------------------------------
# 名簿管理
# ---------------------------------------------------------------------------


class RosterFolder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="roster_folder_id")
    owner_teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name="roster_folders")
    parent_folder = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
    )
    name = models.CharField(max_length=120)
    sort_order = models.IntegerField(default=0)
    is_dynamic = models.BooleanField(default=False)
    dynamic_filter = models.JSONField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "roster_folders"
        constraints = [
            models.UniqueConstraint(
                fields=["owner_teacher", "parent_folder", "name"],
                condition=Q(parent_folder__isnull=False),
                name="rf_unique_child",
            ),
            models.UniqueConstraint(
                fields=["owner_teacher", "name"],
                condition=Q(parent_folder__isnull=True),
                name="rf_unique_root",
            ),
            models.CheckConstraint(
                check=~Q(parent_folder=F("id")),
                name="rf_no_self_parent",
            ),
        ]
        indexes = [
            models.Index(fields=["owner_teacher"], name="rf_owner_idx"),
            models.Index(fields=["parent_folder"], name="rf_parent_idx"),
            models.Index(fields=["archived_at"], name="rf_archived_idx"),
            models.Index(fields=["created_at"], name="rf_created_idx"),
        ]

    def __str__(self) -> str:
        return self.name


class RosterMembership(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="roster_membership_id")
    roster_folder = models.ForeignKey(RosterFolder, on_delete=models.CASCADE, related_name="memberships")
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="roster_memberships")
    added_at = models.DateTimeField(default=timezone.now)
    removed_at = models.DateTimeField(null=True, blank=True)
    note = models.CharField(max_length=200, null=True, blank=True)

    class Meta:
        db_table = "roster_memberships"
        constraints = [
            models.UniqueConstraint(
                fields=["roster_folder", "student"],
                condition=Q(removed_at__isnull=True),
                name="rm_active_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["roster_folder"], name="rm_folder_idx"),
            models.Index(fields=["student"], name="rm_student_idx"),
            models.Index(fields=["removed_at"], name="rm_removed_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.roster_folder.name} -> {self.student.email}"


# ---------------------------------------------------------------------------
# 語彙 / 教材
# ---------------------------------------------------------------------------


def _normalize_text(value: str) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    stripped = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return stripped.lower().strip()


class VocabVisibility(models.TextChoices):
    PRIVATE = "private", "private"
    PUBLIC = "public", "public"


class VocabStatus(models.TextChoices):
    DRAFT = "draft", "draft"
    PROPOSED = "proposed", "proposed"
    PUBLISHED = "published", "published"
    ARCHIVED = "archived", "archived"


class Vocabulary(CreatedUpdatedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="vocabulary_id")
    text_en = models.CharField(max_length=120)
    # 大文字小文字を区別しない検索は、アプリケーションレイヤーで正規化して対応
    text_key = models.TextField(editable=False)
    part_of_speech = models.CharField(max_length=30, null=True, blank=True)
    explanation = models.TextField(null=True, blank=True)
    example_en = models.TextField(null=True, blank=True)
    example_ja = models.TextField(null=True, blank=True)
    sort_key = models.CharField(max_length=255, editable=False)
    head_letter = models.CharField(max_length=1, editable=False)
    sense_count = models.IntegerField(default=1)
    visibility = models.CharField(max_length=16, choices=VocabVisibility.choices, default=VocabVisibility.PRIVATE)
    status = models.CharField(max_length=16, choices=VocabStatus.choices, default=VocabStatus.DRAFT)
    created_by_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_vocabularies",
    )
    created_by_teacher = models.ForeignKey(
        Teacher,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_vocabularies",
    )
    alias_of = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="aliases",
        db_column="alias_of_vocabulary_id",
    )
    published_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "vocabularies"
        constraints = [
            models.CheckConstraint(
                check=Q(visibility=VocabVisibility.PUBLIC)
                | Q(created_by_user__isnull=False)
                | Q(created_by_teacher__isnull=False),
                name="vocab_owner_required",
            ),
            models.CheckConstraint(
                check=~(Q(created_by_user__isnull=False) & Q(created_by_teacher__isnull=False)),
                name="vocab_single_owner",
            ),
            models.UniqueConstraint(
                fields=["text_key"],
                condition=Q(visibility=VocabVisibility.PUBLIC, status=VocabStatus.PUBLISHED),
                name="vocab_public_unique",
            ),
            models.UniqueConstraint(
                fields=["text_key", "created_by_user"],
                condition=Q(visibility=VocabVisibility.PRIVATE, created_by_user__isnull=False),
                name="vocab_private_user_unique",
            ),
            models.UniqueConstraint(
                fields=["text_key", "created_by_teacher"],
                condition=Q(visibility=VocabVisibility.PRIVATE, created_by_teacher__isnull=False),
                name="vocab_private_teacher_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["sort_key"], name="vocab_sort_idx"),
            models.Index(fields=["head_letter"], name="vocab_head_idx"),
            models.Index(fields=["visibility"], name="vocab_visibility_idx"),
            models.Index(fields=["status"], name="vocab_status_idx"),
            models.Index(fields=["archived_at"], name="vocab_archived_idx"),
        ]

    def save(self, *args, **kwargs):  # type: ignore[override]
        normalized = _normalize_text(self.text_en)
        text_key = normalized

        if (
            self.visibility == VocabVisibility.PUBLIC
            and self.status == VocabStatus.PUBLISHED
        ):
            conflict_qs = self.__class__.objects.filter(
                text_key=text_key,
                visibility=VocabVisibility.PUBLIC,
                status=VocabStatus.PUBLISHED,
            )
            if self.pk:
                conflict_qs = conflict_qs.exclude(pk=self.pk)

            if conflict_qs.exists():
                variant_seed = _normalize_text(self.part_of_speech or "variant") or "variant"
                digest = hashlib.sha1(self.text_en.lower().encode("utf-8")).hexdigest()[:6]
                suffix_index = 1

                while True:
                    candidate = f"{normalized}::{variant_seed}-{digest}-{suffix_index}"
                    candidate_qs = self.__class__.objects.filter(
                        text_key=candidate,
                        visibility=VocabVisibility.PUBLIC,
                        status=VocabStatus.PUBLISHED,
                    )
                    if self.pk:
                        candidate_qs = candidate_qs.exclude(pk=self.pk)
                    if not candidate_qs.exists():
                        text_key = candidate
                        break
                    suffix_index += 1

        self.text_key = text_key
        self.sort_key = normalized
        self.head_letter = normalized[:1] if normalized else ""
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.text_en


class VocabTranslation(CreatedUpdatedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="vocab_translation_id")
    vocabulary = models.ForeignKey(Vocabulary, on_delete=models.CASCADE, related_name="translations")
    text_ja = models.CharField(max_length=120)
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = "vocab_translations"
        constraints = [
            models.UniqueConstraint(
                fields=["vocabulary", "text_ja"],
                name="vocab_trans_unique",
            ),
            models.UniqueConstraint(
                fields=["vocabulary"],
                condition=Q(is_primary=True),
                name="vocab_trans_primary_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["vocabulary"], name="vtrans_vocab_idx"),
            models.Index(fields=["is_primary"], name="vtrans_primary_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.vocabulary.text_en}: {self.text_ja}"


class VocabChoice(CreatedUpdatedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="vocab_choice_id")
    vocabulary = models.ForeignKey(Vocabulary, on_delete=models.CASCADE, related_name="choices")
    text_ja = models.CharField(max_length=120)
    is_correct = models.BooleanField(default=False)
    weight = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    source_vocabulary = models.ForeignKey(
        Vocabulary,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="borrowed_choices",
    )

    class Meta:
        db_table = "vocab_choice_bank"
        constraints = [
            models.UniqueConstraint(
                fields=["vocabulary", "text_ja"],
                name="vocab_choice_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["vocabulary"], name="vchoice_vocab_idx"),
            models.Index(fields=["vocabulary", "is_correct"], name="vchoice_correct_idx"),
            models.Index(fields=["vocabulary", "weight"], name="vchoice_weight_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.vocabulary.text_en}: {self.text_ja}"


class QuizScope(models.TextChoices):
    DEFAULT = "default", "default"
    CUSTOM = "custom", "custom"


class QuizCollection(CreatedUpdatedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="quiz_collection_id")
    scope = models.CharField(max_length=16, choices=QuizScope.choices)
    owner_user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name="quiz_collections")
    title = models.CharField(max_length=120)
    description = models.TextField(null=True, blank=True)
    order_index = models.IntegerField(default=0)
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    origin_collection = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="derived_collections",
        db_column="origin_collection_id",
    )
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "quiz_collections"
        constraints = [
            models.UniqueConstraint(
                fields=["owner_user", "title"],
                condition=Q(archived_at__isnull=True),
                name="quiz_collection_title_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["scope", "owner_user"], name="qc_scope_idx"),
            models.Index(fields=["archived_at"], name="qc_archived_idx"),
        ]

    def __str__(self) -> str:
        return self.title


class Quiz(CreatedUpdatedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="quiz_id")
    quiz_collection = models.ForeignKey(QuizCollection, on_delete=models.CASCADE, related_name="quizzes")
    sequence_no = models.IntegerField(default=1)
    title = models.CharField(max_length=120, null=True, blank=True)
    timer_seconds = models.IntegerField(null=True, blank=True, default=10)
    origin_quiz = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="derived_quizzes",
        db_column="origin_quiz_id",
    )
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "quizzes"
        constraints = [
            models.UniqueConstraint(
                fields=["quiz_collection", "sequence_no"],
                condition=Q(archived_at__isnull=True),
                name="quiz_sequence_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["quiz_collection"], name="quiz_collection_idx"),
            models.Index(fields=["archived_at"], name="quiz_archived_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.quiz_collection.title}#{self.sequence_no}"


class QuizQuestion(CreatedUpdatedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="quiz_question_id")
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="questions")
    vocabulary = models.ForeignKey(Vocabulary, on_delete=models.RESTRICT, related_name="quiz_questions")
    question_order = models.IntegerField()
    note = models.TextField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "quiz_questions"
        constraints = [
            models.UniqueConstraint(
                fields=["quiz", "question_order"],
                condition=Q(archived_at__isnull=True),
                name="quiz_question_order_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["quiz"], name="qq_quiz_idx"),
            models.Index(fields=["vocabulary"], name="qq_vocab_idx"),
            models.Index(fields=["archived_at"], name="qq_archived_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.quiz_id} - {self.question_order}"


# ---------------------------------------------------------------------------
# クイズ実行
# ---------------------------------------------------------------------------


class QuizResult(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="quiz_result_id")
    user = models.ForeignKey(User, on_delete=models.RESTRICT, related_name="quiz_results")
    quiz = models.ForeignKey(Quiz, on_delete=models.RESTRICT, related_name="results")
    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)
    total_time_ms = models.IntegerField(null=True, blank=True)
    score = models.IntegerField(null=True, blank=True, default=0)

    class Meta:
        db_table = "quiz_results"
        indexes = [
            models.Index(fields=["user", "started_at"], name="qr_user_idx"),
            models.Index(fields=["quiz"], name="qr_quiz_idx"),
        ]

    def __str__(self) -> str:
        return f"QuizResult<{self.user.email} {self.quiz_id}>"


class QuizResultDetail(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="quiz_result_detail_id")
    quiz_result = models.ForeignKey(QuizResult, on_delete=models.CASCADE, related_name="details")
    question_order = models.IntegerField()
    vocabulary = models.ForeignKey(Vocabulary, on_delete=models.RESTRICT, related_name="quiz_result_details")
    selected_text = models.CharField(max_length=120, null=True, blank=True)
    is_correct = models.BooleanField(default=False)
    reaction_time_ms = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "quiz_result_details"
        constraints = [
            models.UniqueConstraint(
                fields=["quiz_result", "question_order"],
                name="quiz_result_detail_order_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["quiz_result"], name="qrd_result_idx"),
            models.Index(fields=["vocabulary"], name="qrd_vocab_idx"),
            models.Index(fields=["created_at"], name="qrd_created_idx"),
        ]

    def __str__(self) -> str:
        return f"QuizResultDetail<{self.quiz_result_id} #{self.question_order}>"


# ---------------------------------------------------------------------------
# テスト配布 / 結果
# ---------------------------------------------------------------------------


class Test(CreatedUpdatedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="test_id")
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name="tests")
    title = models.CharField(max_length=120)
    description = models.TextField(null=True, blank=True)
    due_at = models.DateTimeField(null=True, blank=True)
    max_attempts_per_student = models.IntegerField(default=1000)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "tests"
        constraints = [
            models.CheckConstraint(
                check=Q(max_attempts_per_student__gte=1),
                name="tests_max_attempts_check",
            ),
        ]
        indexes = [
            models.Index(fields=["teacher"], name="tests_teacher_idx"),
            models.Index(fields=["due_at"], name="tests_due_idx"),
            models.Index(fields=["archived_at"], name="tests_archived_idx"),
        ]

    def __str__(self) -> str:
        return self.title


class TestQuestion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="test_question_id")
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name="questions")
    vocabulary = models.ForeignKey(Vocabulary, on_delete=models.RESTRICT, related_name="test_questions")
    question_order = models.IntegerField()
    weight = models.DecimalField(max_digits=4, decimal_places=2, default=1.0, null=True, blank=True)
    timer_seconds = models.IntegerField(default=10)

    class Meta:
        db_table = "test_questions"
        constraints = [
            models.UniqueConstraint(
                fields=["test", "question_order"],
                name="test_question_order_unique",
            ),
            models.CheckConstraint(
                check=Q(timer_seconds__gt=0),
                name="test_question_timer_check",
            ),
        ]
        indexes = [
            models.Index(fields=["test"], name="tq_test_idx"),
            models.Index(fields=["vocabulary"], name="tq_vocab_idx"),
        ]

    def __str__(self) -> str:
        return f"TestQuestion<{self.test_id} #{self.question_order}>"


class TestAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="test_assignment_id")
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name="assignments")
    assigned_by_teacher = models.ForeignKey(
        Teacher,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="performed_assignments",
    )
    assigned_at = models.DateTimeField(default=timezone.now)
    note = models.CharField(max_length=200, null=True, blank=True)
    run_params = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "test_assignments"
        indexes = [
            models.Index(fields=["test"], name="ta_test_idx"),
            models.Index(fields=["assigned_at"], name="ta_assigned_idx"),
        ]

    def __str__(self) -> str:
        return f"TestAssignment<{self.test_id} {self.assigned_at.isoformat()}>"


class TestAssignee(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="test_assignee_id")
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name="assignees")
    student = models.ForeignKey(User, on_delete=models.RESTRICT, related_name="test_assignments")
    test_assignment = models.ForeignKey(TestAssignment, on_delete=models.SET_NULL, null=True, blank=True, related_name="assignees")
    source_type = models.CharField(max_length=16, null=True, blank=True)
    source_folder = models.ForeignKey(RosterFolder, on_delete=models.SET_NULL, null=True, blank=True, related_name="test_assignees")
    assigned_by_teacher = models.ForeignKey(
        Teacher,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="direct_assignees",
    )
    assigned_at = models.DateTimeField(default=timezone.now)
    max_attempts = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = "test_assignees"
        constraints = [
            models.UniqueConstraint(
                fields=["test", "student"],
                name="test_assignee_unique",
            ),
            models.CheckConstraint(
                check=Q(max_attempts__isnull=True) | Q(max_attempts__gte=1),
                name="test_assignee_max_check",
            ),
            models.CheckConstraint(
                check=Q(source_type__isnull=True) | Q(source_type__in=["folder", "manual", "api"]),
                name="test_assignee_source_check",
            ),
        ]
        indexes = [
            models.Index(fields=["test"], name="tas_test_idx"),
            models.Index(fields=["student"], name="tas_student_idx"),
            models.Index(fields=["assigned_at"], name="tas_assigned_idx"),
        ]

    def __str__(self) -> str:
        return f"TestAssignee<{self.test_id} {self.student.email}>"


class TestResult(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="test_result_id")
    test = models.ForeignKey(Test, on_delete=models.RESTRICT, related_name="results")
    student = models.ForeignKey(User, on_delete=models.RESTRICT, related_name="test_results")
    test_assignee = models.ForeignKey(TestAssignee, on_delete=models.SET_NULL, null=True, blank=True, related_name="results")
    attempt_no = models.IntegerField(default=1)
    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)
    score = models.IntegerField(null=True, blank=True, default=0)

    class Meta:
        db_table = "test_results"
        constraints = [
            models.UniqueConstraint(
                fields=["test", "student", "attempt_no"],
                name="test_result_attempt_unique",
            ),
            models.UniqueConstraint(
                fields=["test_assignee", "attempt_no"],
                condition=Q(test_assignee__isnull=False),
                name="test_result_assignee_unique",
            ),
            models.CheckConstraint(
                check=Q(attempt_no__gte=1),
                name="test_result_attempt_check",
            ),
        ]
        indexes = [
            models.Index(fields=["test"], name="tr_test_idx"),
            models.Index(fields=["student", "started_at"], name="tr_student_idx"),
        ]

    def __str__(self) -> str:
        return f"TestResult<{self.test_id} {self.student.email} #{self.attempt_no}>"


class TestResultDetail(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="test_result_detail_id")
    test_result = models.ForeignKey(TestResult, on_delete=models.CASCADE, related_name="details")
    question_order = models.IntegerField()
    vocabulary = models.ForeignKey(Vocabulary, on_delete=models.RESTRICT, related_name="test_result_details")
    selected_choice = models.ForeignKey(VocabChoice, on_delete=models.SET_NULL, null=True, blank=True, related_name="test_result_details")
    selected_text = models.CharField(max_length=120, null=True, blank=True)
    is_correct = models.BooleanField(null=True, blank=True)
    reaction_time_ms = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "test_result_details"
        constraints = [
            models.UniqueConstraint(
                fields=["test_result", "question_order"],
                name="test_result_detail_order_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["test_result"], name="trd_result_idx"),
            models.Index(fields=["vocabulary"], name="trd_vocab_idx"),
            models.Index(fields=["created_at"], name="trd_created_idx"),
        ]

    def __str__(self) -> str:
        return f"TestResultDetail<{self.test_result_id} #{self.question_order}>"


__all__ = [
    "InvitationCode",
    "LinkStatus",
    "Quiz",
    "QuizCollection",
    "QuizQuestion",
    "QuizResult",
    "QuizResultDetail",
    "QuizScope",
    "RosterFolder",
    "RosterMembership",
    "StudentTeacherLink",
    "Teacher",
    "TeacherProfile",
    "TeacherWhitelist",
    "Test",
    "TestAssignment",
    "TestAssignee",
    "TestQuestion",
    "TestResult",
    "TestResultDetail",
    "User",
    "UserProfile",
    "VocabChoice",
    "VocabStatus",
    "VocabTranslation",
    "VocabVisibility",
    "Vocabulary",
]
