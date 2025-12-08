"""新スキーマ用シリアライザー"""

from typing import Optional
from urllib.parse import urljoin

from django.conf import settings
from django.http import HttpRequest
from rest_framework import serializers

from . import models
from .utils import is_teacher_whitelisted


def build_absolute_media_url(request: Optional[HttpRequest], relative_path: Optional[str]):
    if not relative_path:
        return None
    if isinstance(relative_path, str) and relative_path.startswith(("http://", "https://")):
        return relative_path
    joined = urljoin(settings.MEDIA_URL, relative_path.lstrip("/"))
    if request is None:
        return joined
    return request.build_absolute_uri(joined)


class UserSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.User
        fields = [
            "user_id",
            "email",
            "oauth_provider",
            "oauth_sub",
            "disabled_at",
            "deleted_at",
            "created_at",
            "updated_at",
            "is_active",
        ]
        read_only_fields = ["created_at", "updated_at"]


class UserProfileSerializer(serializers.ModelSerializer):
    user = serializers.UUIDField(source="user_id", read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = models.UserProfile
        fields = [
            "user",
            "display_name",
            "avatar_url",
            "grade",
            "self_intro",
            "updated_at",
        ]
        read_only_fields = ["user", "updated_at"]

    def get_avatar_url(self, obj):
        return build_absolute_media_url(self.context.get("request"), getattr(obj, "avatar_url", None))


class TeacherSerializer(serializers.ModelSerializer):
    teacher_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.Teacher
        fields = [
            "teacher_id",
            "email",
            "oauth_provider",
            "oauth_sub",
            "last_login",
            "disabled_at",
            "deleted_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class TeacherProfileSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = models.TeacherProfile
        fields = [
            "teacher",
            "display_name",
            "affiliation",
            "avatar_url",
            "bio",
            "updated_at",
        ]
        read_only_fields = ["teacher", "updated_at"]

    def get_avatar_url(self, obj):
        return build_absolute_media_url(self.context.get("request"), getattr(obj, "avatar_url", None))


class TeacherWhitelistSerializer(serializers.ModelSerializer):
    teachers_whitelist_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.TeacherWhitelist
        fields = [
            "teachers_whitelist_id",
            "email",
            "can_publish_vocab",
            "note",
            "revoked_at",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class InvitationCodeSerializer(serializers.ModelSerializer):
    invitation_code_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.InvitationCode
        fields = [
            "invitation_code_id",
            "invitation_code",
            "issued_by",
            "issued_at",
            "expires_at",
            "used_by",
            "used_at",
            "revoked",
            "revoked_at",
        ]
        read_only_fields = ["issued_at"]


class StudentTeacherLinkSerializer(serializers.ModelSerializer):
    student_teacher_link_id = serializers.UUIDField(source="id", read_only=True)
    teacher_email = serializers.EmailField(source="teacher.email", read_only=True)
    teacher_display_name = serializers.SerializerMethodField()
    student_display_name = serializers.SerializerMethodField()
    student_grade = serializers.SerializerMethodField()
    student_self_intro = serializers.SerializerMethodField()
    student_avatar_url = serializers.SerializerMethodField()
    student_profile_updated_at = serializers.SerializerMethodField()

    class Meta:
        model = models.StudentTeacherLink
        fields = [
            "student_teacher_link_id",
            "teacher",
            "teacher_email",
            "teacher_display_name",
            "student",
            "status",
            "linked_at",
            "revoked_at",
            "revoked_by_teacher",
            "revoked_by_student",
            "invitation",
            "custom_display_name",
            "private_note",
            "local_student_code",
            "tags",
            "kana_for_sort",
            "color",
            "updated_at",
            "student_display_name",
            "student_grade",
            "student_self_intro",
            "student_avatar_url",
            "student_profile_updated_at",
        ]
        read_only_fields = ["linked_at", "updated_at"]

    def get_teacher_display_name(self, obj):
        profile = getattr(obj.teacher, "profile", None)
        if profile and profile.display_name:
            return profile.display_name
        return obj.teacher.email

    def _student_profile(self, obj):
        try:
            return obj.student.profile
        except Exception:
            return None

    def get_student_display_name(self, obj):
        profile = self._student_profile(obj)
        if profile and profile.display_name:
            return profile.display_name
        return ""

    def get_student_grade(self, obj):
        profile = self._student_profile(obj)
        return profile.grade if profile else None

    def get_student_self_intro(self, obj):
        profile = self._student_profile(obj)
        return profile.self_intro if profile else None

    def get_student_avatar_url(self, obj):
        profile = self._student_profile(obj)
        return build_absolute_media_url(self.context.get("request"), profile.avatar_url if profile else None)

    def get_student_profile_updated_at(self, obj):
        profile = self._student_profile(obj)
        return profile.updated_at if profile else None


class StudentTeacherPublicProfileSerializer(serializers.Serializer):
    teacher_id = serializers.UUIDField(read_only=True)
    display_name = serializers.CharField(read_only=True)
    affiliation = serializers.CharField(allow_null=True, allow_blank=True, read_only=True)
    avatar_url = serializers.SerializerMethodField()
    bio = serializers.CharField(allow_null=True, allow_blank=True, read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def get_avatar_url(self, obj):
        if isinstance(obj, dict):
            url = obj.get("avatar_url")
        else:
            url = getattr(obj, "avatar_url", None)
        return build_absolute_media_url(self.context.get("request"), url)


class TeacherStudentListSerializer(serializers.ModelSerializer):
    student_teacher_link_id = serializers.UUIDField(source="id", read_only=True)
    display_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    def _safe_profile(self, user: models.User):
        try:
            return user.profile
        except Exception:
            return None

    class Meta:
        model = models.StudentTeacherLink
        fields = [
            "student_teacher_link_id",
            "display_name",
            "status",
            "linked_at",
            "custom_display_name",
            "local_student_code",
            "tags",
            "private_note",
            "kana_for_sort",
            "color",
            "avatar_url",
        ]
        read_only_fields = ["status", "linked_at"]

    def get_display_name(self, obj):
        if obj.custom_display_name:
            return obj.custom_display_name
        profile = self._safe_profile(obj.student)
        return profile.display_name if profile and profile.display_name else ""

    def get_avatar_url(self, obj):
        profile = self._safe_profile(obj.student)
        return build_absolute_media_url(self.context.get("request"), profile.avatar_url if profile else None)


class RosterFolderSerializer(serializers.ModelSerializer):
    roster_folder_id = serializers.UUIDField(source="id", read_only=True)
    member_count = serializers.SerializerMethodField()
    parent_folder_id = serializers.UUIDField(source="parent_folder.id", read_only=True)

    class Meta:
        model = models.RosterFolder
        fields = [
            "roster_folder_id",
            "parent_folder",
            "parent_folder_id",
            "name",
            "sort_order",
            "is_dynamic",
            "dynamic_filter",
            "notes",
            "archived_at",
            "created_at",
            "member_count",
        ]
        read_only_fields = ["created_at", "member_count", "is_dynamic", "dynamic_filter", "archived_at"]

    def get_member_count(self, obj):
        return obj.memberships.filter(removed_at__isnull=True).count()


class RosterMembershipSerializer(serializers.ModelSerializer):
    roster_membership_id = serializers.UUIDField(source="id", read_only=True)
    roster_folder_id = serializers.UUIDField(source="roster_folder.id", read_only=True)
    student_teacher_link_id = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    local_student_code = serializers.SerializerMethodField()
    _profile_cache: dict[str, models.UserProfile | None] = {}

    class Meta:
        model = models.RosterMembership
        fields = [
            "roster_membership_id",
            "roster_folder",
            "roster_folder_id",
            "student",
            "student_teacher_link_id",
            "display_name",
            "status",
            "avatar_url",
            "tags",
            "local_student_code",
            "added_at",
            "removed_at",
            "note",
        ]
        read_only_fields = [
            "added_at",
            "roster_folder_id",
            "student_teacher_link_id",
            "display_name",
            "status",
            "avatar_url",
            "tags",
            "local_student_code",
        ]

    def _get_teacher_link(self, obj: models.RosterMembership):
        teacher = self.context.get("teacher")
        if not teacher:
            return None
        links = getattr(obj.student, "prefetched_teacher_links", None) or getattr(obj.student, "teacher_links", None)
        if links:
            for link in links:
                if link.teacher_id == teacher.id and link.status != models.LinkStatus.REVOKED:
                    return link
        return (
            models.StudentTeacherLink.objects.filter(student=obj.student, teacher=teacher).exclude(
                status=models.LinkStatus.REVOKED
            )
            .select_related("student__profile")
            .first()
        )

    def get_student_teacher_link_id(self, obj):
        link = self._get_teacher_link(obj)
        return str(link.id) if link else None

    def get_display_name(self, obj):
        link = self._get_teacher_link(obj)
        if link and link.custom_display_name:
            return link.custom_display_name
        profile = self._safe_profile(obj.student)
        return profile.display_name if profile and profile.display_name else ""

    def get_avatar_url(self, obj):
        profile = self._safe_profile(obj.student)
        return build_absolute_media_url(self.context.get("request"), profile.avatar_url if profile else None)

    def get_status(self, obj):
        link = self._get_teacher_link(obj)
        return link.status if link else ""

    def get_tags(self, obj):
        link = self._get_teacher_link(obj)
        return link.tags if link and link.tags is not None else []

    def get_local_student_code(self, obj):
        link = self._get_teacher_link(obj)
        return link.local_student_code if link else None

    def _safe_profile(self, user: models.User):
        cache_key = str(user.pk)
        if cache_key in self._profile_cache:
            return self._profile_cache[cache_key]
        profile = None
        try:
            profile = user.profile
        except Exception:
            profile = None
        self._profile_cache[cache_key] = profile
        return profile


class VocabularySerializer(serializers.ModelSerializer):
    vocabulary_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.Vocabulary
        fields = [
            "vocabulary_id",
            "text_en",
            "text_key",
            "part_of_speech",
            "explanation",
            "example_en",
            "example_ja",
            "sort_key",
            "head_letter",
            "sense_count",
            "visibility",
            "status",
            "created_by_user",
            "created_by_teacher",
            "alias_of",
            "published_at",
            "archived_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["text_key", "sort_key", "head_letter", "created_at", "updated_at"]


class VocabTranslationSerializer(serializers.ModelSerializer):
    vocab_translation_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.VocabTranslation
        fields = [
            "vocab_translation_id",
            "vocabulary",
            "text_ja",
            "is_primary",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class VocabChoiceSerializer(serializers.ModelSerializer):
    vocab_choice_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.VocabChoice
        fields = [
            "vocab_choice_id",
            "vocabulary",
            "text_ja",
            "is_correct",
            "weight",
            "source_vocabulary",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        user_is_teacher = False
        if request is not None and request.user and request.user.is_authenticated:
            user_is_teacher = is_teacher_whitelisted(request.user.email)
        if not user_is_teacher:
            data.pop("is_correct", None)
        return data


class QuizCollectionSerializer(serializers.ModelSerializer):
    quiz_collection_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.QuizCollection
        fields = [
            "quiz_collection_id",
            "scope",
            "owner_user",
            "title",
            "description",
            "level_code",
            "level_label",
            "level_order",
            "order_index",
            "is_published",
            "published_at",
            "origin_collection",
            "archived_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class QuizSerializer(serializers.ModelSerializer):
    quiz_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.Quiz
        fields = [
            "quiz_id",
            "quiz_collection",
            "sequence_no",
            "title",
            "section_no",
            "section_label",
            "timer_seconds",
            "origin_quiz",
            "archived_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class QuizQuestionSerializer(serializers.ModelSerializer):
    quiz_question_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.QuizQuestion
        fields = [
            "quiz_question_id",
            "quiz",
            "vocabulary",
            "question_order",
            "note",
            "archived_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class QuizResultSerializer(serializers.ModelSerializer):
    quiz_result_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.QuizResult
        fields = [
            "quiz_result_id",
            "user",
            "quiz",
            "started_at",
            "completed_at",
            "total_time_ms",
            "score",
            "question_count",
            "timeout_count",
        ]
        read_only_fields = ["started_at", "user"]


class QuizResultDetailSerializer(serializers.ModelSerializer):
    quiz_result_detail_id = serializers.UUIDField(source="id", read_only=True)
    correct_text = serializers.SerializerMethodField()

    class Meta:
        model = models.QuizResultDetail
        fields = [
            "quiz_result_detail_id",
            "quiz_result",
            "question_order",
            "vocabulary",
            "selected_text",
            "correct_text",
            "is_correct",
            "is_timeout",
            "reaction_time_ms",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_correct_text(self, obj) -> str | None:
        # 優先: クエリセット側で注入したサブクエリ値
        annotated = getattr(obj, "correct_text", None)
        if annotated:
            return annotated

        # 次に正解選択肢
        choice = obj.vocabulary.choices.filter(is_correct=True).order_by("created_at").first()
        if choice:
            return choice.text_ja

        # 最後に翻訳のプライマリ
        translation = obj.vocabulary.translations.filter(is_primary=True).order_by("created_at").first()
        if translation:
            return translation.text_ja

        return None


class UserVocabStatusSerializer(serializers.ModelSerializer):
    user_vocab_status_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.UserVocabStatus
        fields = [
            "user_vocab_status_id",
            "user",
            "vocabulary",
            "status",
            "last_result",
            "last_answered_at",
            "recent_correct_streak",
            "total_answer_count",
            "total_correct_count",
            "timeout_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "user"]


class LearningActivityLogSerializer(serializers.ModelSerializer):
    learning_activity_log_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.LearningActivityLog
        fields = [
            "learning_activity_log_id",
            "user",
            "quiz_result",
            "occurred_at",
            "correct_count",
            "incorrect_count",
            "timeout_count",
            "total_time_ms",
        ]
        read_only_fields = ["occurred_at", "user"]


class LearningSummaryDailySerializer(serializers.ModelSerializer):
    learning_summary_daily_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.LearningSummaryDaily
        fields = [
            "learning_summary_daily_id",
            "user",
            "activity_date",
            "correct_count",
            "incorrect_count",
            "timeout_count",
            "total_time_ms",
            "streak_count",
            "updated_at",
        ]
        read_only_fields = ["updated_at", "user"]


class TestSerializer(serializers.ModelSerializer):
    test_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.Test
        fields = [
            "test_id",
            "teacher",
            "title",
            "description",
            "due_at",
            "max_attempts_per_student",
            "archived_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class TestQuestionSerializer(serializers.ModelSerializer):
    test_question_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.TestQuestion
        fields = [
            "test_question_id",
            "test",
            "vocabulary",
            "question_order",
            "weight",
            "timer_seconds",
        ]


class TestAssignmentSerializer(serializers.ModelSerializer):
    test_assignment_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.TestAssignment
        fields = [
            "test_assignment_id",
            "test",
            "assigned_by_teacher",
            "assigned_at",
            "note",
            "run_params",
        ]
        read_only_fields = ["assigned_at"]


class TestAssigneeSerializer(serializers.ModelSerializer):
    test_assignee_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.TestAssignee
        fields = [
            "test_assignee_id",
            "test",
            "student",
            "test_assignment",
            "source_type",
            "source_folder",
            "assigned_by_teacher",
            "assigned_at",
            "max_attempts",
        ]
        read_only_fields = ["assigned_at"]


class TestResultSerializer(serializers.ModelSerializer):
    test_result_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.TestResult
        fields = [
            "test_result_id",
            "test",
            "student",
            "test_assignee",
            "attempt_no",
            "started_at",
            "completed_at",
            "score",
        ]
        read_only_fields = ["started_at"]


class TestResultDetailSerializer(serializers.ModelSerializer):
    test_result_detail_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.TestResultDetail
        fields = [
            "test_result_detail_id",
            "test_result",
            "question_order",
            "vocabulary",
            "selected_choice",
            "selected_text",
            "is_correct",
            "reaction_time_ms",
            "created_at",
        ]
        read_only_fields = ["created_at"]


# ---------------------------------------------------------------------------
# 学習者用語彙API専用シリアライザー
# ---------------------------------------------------------------------------


class StudentVocabUserStatusSerializer(serializers.Serializer):
    """学習者の語彙学習ステータス（埋め込み用）"""
    status = serializers.CharField()
    total_answer_count = serializers.IntegerField()
    total_correct_count = serializers.IntegerField()
    correct_rate = serializers.IntegerField(allow_null=True)
    recent_correct_streak = serializers.IntegerField()
    last_result = serializers.CharField(allow_null=True)
    last_answered_at = serializers.DateTimeField(allow_null=True)


class StudentVocabListSerializer(serializers.ModelSerializer):
    """学習者用語彙一覧シリアライザー"""
    id = serializers.UUIDField(source="pk", read_only=True)
    primary_translation = serializers.SerializerMethodField()
    user_status = serializers.SerializerMethodField()

    class Meta:
        model = models.Vocabulary
        fields = [
            "id",
            "text_en",
            "part_of_speech",
            "visibility",
            "status",
            "primary_translation",
            "user_status",
        ]

    def get_primary_translation(self, obj) -> str | None:
        """主訳を取得（prefetchされた primary_translation_list を利用）"""
        primary_list = getattr(obj, "primary_translation_list", None)
        if primary_list and len(primary_list) > 0:
            return primary_list[0].text_ja
        return None

    def get_user_status(self, obj) -> dict | None:
        """ユーザーの学習ステータスを取得（prefetchされた user_status_list を利用）"""
        user_status_list = getattr(obj, "user_status_list", None)
        if not user_status_list or len(user_status_list) == 0:
            return None

        status_obj = user_status_list[0]
        total_answer_count = status_obj.total_answer_count or 0
        total_correct_count = status_obj.total_correct_count or 0
        correct_rate = None
        if total_answer_count > 0:
            correct_rate = round((total_correct_count / total_answer_count) * 100)

        return {
            "status": status_obj.status,
            "total_answer_count": total_answer_count,
            "total_correct_count": total_correct_count,
            "correct_rate": correct_rate,
            "recent_correct_streak": status_obj.recent_correct_streak or 0,
            "last_result": status_obj.last_result,
            "last_answered_at": status_obj.last_answered_at,
        }


class StudentVocabAliasSerializer(serializers.ModelSerializer):
    """エイリアス語彙の簡易表現"""
    id = serializers.UUIDField(source="pk", read_only=True)

    class Meta:
        model = models.Vocabulary
        fields = ["id", "text_en"]


class StudentVocabTranslationSerializer(serializers.ModelSerializer):
    """語彙詳細用の翻訳シリアライザー"""
    id = serializers.UUIDField(source="pk", read_only=True)

    class Meta:
        model = models.VocabTranslation
        fields = ["id", "text_ja", "is_primary"]


class StudentVocabChoiceSerializer(serializers.ModelSerializer):
    """語彙詳細用の選択肢シリアライザー"""
    id = serializers.UUIDField(source="pk", read_only=True)

    class Meta:
        model = models.VocabChoice
        fields = ["id", "text_ja", "is_correct"]


class StudentVocabDetailSerializer(serializers.ModelSerializer):
    """学習者用語彙詳細シリアライザー"""
    id = serializers.UUIDField(source="pk", read_only=True)
    alias_of = StudentVocabAliasSerializer(read_only=True)
    aliases = StudentVocabAliasSerializer(many=True, read_only=True)
    translations = StudentVocabTranslationSerializer(many=True, read_only=True)
    choices = StudentVocabChoiceSerializer(many=True, read_only=True)
    user_status = serializers.SerializerMethodField()
    quiz_count = serializers.SerializerMethodField()

    class Meta:
        model = models.Vocabulary
        fields = [
            "id",
            "text_en",
            "part_of_speech",
            "explanation",
            "example_en",
            "example_ja",
            "alias_of",
            "aliases",
            "translations",
            "choices",
            "user_status",
            "quiz_count",
        ]

    def get_user_status(self, obj) -> dict | None:
        """ユーザーの学習ステータスを取得"""
        user_status_list = getattr(obj, "user_status_list", None)
        if not user_status_list or len(user_status_list) == 0:
            return None

        status_obj = user_status_list[0]
        total_answer_count = status_obj.total_answer_count or 0
        total_correct_count = status_obj.total_correct_count or 0
        correct_rate = None
        if total_answer_count > 0:
            correct_rate = round((total_correct_count / total_answer_count) * 100)

        return {
            "status": status_obj.status,
            "total_answer_count": total_answer_count,
            "total_correct_count": total_correct_count,
            "correct_rate": correct_rate,
            "recent_correct_streak": status_obj.recent_correct_streak or 0,
            "last_result": status_obj.last_result,
            "last_answered_at": status_obj.last_answered_at,
        }

    def get_quiz_count(self, obj) -> int:
        """クイズ/テストでの出題回数"""
        quiz_count = getattr(obj, "quiz_question_count", 0) or 0
        test_count = getattr(obj, "test_question_count", 0) or 0
        return quiz_count + test_count


class VocabReportSerializer(serializers.Serializer):
    """語彙誤り報告用シリアライザ"""

    reported_text_en = serializers.CharField(
        max_length=120,
        required=True,
        help_text="問題のある単語（ユーザー視点）",
    )
    main_category = serializers.ChoiceField(
        choices=[
            "translation",
            "part_of_speech",
            "example_sentence",
            "choice_text",
            "spelling",
            "other",
        ],
        required=True,
        help_text="報告の大分類",
    )
    detail_category = serializers.ChoiceField(
        choices=[
            "wrong_meaning",
            "missing_sense",
            "unnatural_ja",
            "typo",
            "format_issue",
            "other",
        ],
        required=True,
        help_text="報告の詳細分類",
    )
    detail_text = serializers.CharField(
        max_length=2000,
        required=True,
        help_text="詳細コメント",
    )
