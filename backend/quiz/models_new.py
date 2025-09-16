from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from django.core.exceptions import ValidationError
import uuid


class User(AbstractUser):
    """ユーザーモデル"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    display_name = models.CharField(max_length=100, blank=True)
    avatar = models.ImageField(blank=True, null=True, upload_to='avatars/')
    avatar_url = models.URLField(blank=True, null=True)
    organization = models.CharField(max_length=200, blank=True)
    bio = models.TextField(blank=True)
    role = models.CharField(max_length=20, choices=[
        ('student', '生徒'),
        ('teacher', '教師'),
        ('admin', '管理者')
    ], default='student')
    created_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(null=True, blank=True)
    level_preference = models.IntegerField(default=1, choices=[
        (1, 'レベル1'),
        (2, 'レベル2'),
        (3, 'レベル3'),
        (4, 'レベル4')
    ])
    quiz_count = models.IntegerField(default=0)
    total_score = models.IntegerField(default=0)
    
    def __str__(self):
        return self.email or self.username
    
    @property
    def average_score(self):
        if self.quiz_count == 0:
            return 0
        return (self.total_score / (self.quiz_count * 10)) * 100
    
    @property
    def is_teacher(self):
        return self.role == 'teacher' or self.is_staff
    
    @property
    def is_admin_user(self):
        return self.role == 'admin' or self.is_superuser


# 要件に基づく新しい単語モデル設計
class Word(models.Model):
    """英単語モデル（要件準拠版）"""
    
    # 品詞の選択肢
    POS_CHOICES = [
        ('noun', '名詞'),
        ('verb', '動詞'),
        ('adj', '形容詞'),
        ('adv', '副詞'),
        ('prep', '前置詞'),
        ('pron', '代名詞'),
        ('det', '限定詞'),
        ('conj', '接続詞'),
        ('interj', '間投詞'),
    ]
    
    # 学年の選択肢
    GRADE_CHOICES = [
        ('J1', '中学1年'),
        ('J2', '中学2年'),
        ('J3', '中学3年'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    text = models.CharField(max_length=100)  # 見出し表示用（綴り）
    lemma = models.CharField(max_length=100, blank=True)  # 見出し語（同じならtextと一致可）
    pos = models.CharField(max_length=10, choices=POS_CHOICES)  # 品詞
    level = models.IntegerField()  # レベル（1以上）
    segment = models.IntegerField()  # セグメント（1以上）
    grade = models.CharField(max_length=3, choices=GRADE_CHOICES, blank=True, null=True)
    explanation = models.TextField(blank=True)  # 事実寄りの補足（語源・注意点等）
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['level', 'segment']),
            models.Index(fields=['pos']),
            models.Index(fields=['grade']),
        ]
        # 同綴りでも品詞違いは別レコード（例：run(n)/run(v)）
        unique_together = ['text', 'pos']
    
    def clean(self):
        if self.level < 1:
            raise ValidationError('レベルは1以上である必要があります')
        if self.segment < 1:
            raise ValidationError('セグメントは1以上である必要があります')
        if not self.lemma:
            self.lemma = self.text  # lemmaが空の場合はtextと同じにする
    
    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.text} ({self.pos}) L{self.level}-S{self.segment}"


class WordTranslation(models.Model):
    """訳語モデル（要件準拠版）"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    word = models.ForeignKey(Word, on_delete=models.CASCADE, related_name='translations')
    language = models.CharField(max_length=5, default='ja')  # 言語コード
    text = models.CharField(max_length=200)  # 訳語
    is_primary = models.BooleanField(default=False)  # 主訳かどうか
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['word']),
        ]
        # 各wordにつき主訳は高々1件
        constraints = [
            models.UniqueConstraint(
                fields=['word'],
                condition=models.Q(is_primary=True),
                name='unique_primary_translation_per_word'
            )
        ]
    
    def __str__(self):
        primary_mark = "★" if self.is_primary else ""
        return f"{self.text} {primary_mark}"


class WordDistractor(models.Model):
    """偽訳モデル（最大3スロット、訳語参照）"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    word = models.ForeignKey(Word, on_delete=models.CASCADE, related_name='distractors')
    slot = models.IntegerField()  # スロット番号（1-3）
    translation = models.ForeignKey(WordTranslation, on_delete=models.RESTRICT)
    
    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['word', 'slot'], name='unique_distractor_slot'),
            models.CheckConstraint(
                check=models.Q(slot__gte=1, slot__lte=3),
                name='valid_distractor_slot'
            )
        ]
    
    def clean(self):
        # 主訳と同一訳は不可
        if self.translation.word == self.word and self.translation.is_primary:
            raise ValidationError('主訳を偽訳として使用することはできません')
        # 同一wordの訳を偽訳に使わない
        if self.translation.word == self.word:
            raise ValidationError('同一単語の訳語を偽訳として使用することはできません')
    
    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.word.text} - slot{self.slot}: {self.translation.text}"


class WordForm(models.Model):
    """語形モデル"""
    
    FEATURE_CHOICES = [
        ('plural', '複数形'),
        ('past', '過去形'),
        ('past_participle', '過去分詞'),
        ('3sg', '三人称単数現在'),
        ('ing', '現在分詞・動名詞'),
        ('comparative', '比較級'),
        ('superlative', '最上級'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    word = models.ForeignKey(Word, on_delete=models.CASCADE, related_name='forms')
    feature = models.CharField(max_length=20, choices=FEATURE_CHOICES)
    form = models.CharField(max_length=100)  # 語形
    
    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['word', 'feature'], name='unique_word_form_feature')
        ]
    
    def __str__(self):
        return f"{self.word.text} ({self.feature}): {self.form}"


class ExampleSentence(models.Model):
    """例文モデル"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    word = models.ForeignKey(Word, on_delete=models.CASCADE, related_name='examples')
    en = models.TextField()  # 英文
    ja = models.TextField(blank=True)  # 日本語文
    source = models.CharField(max_length=200, blank=True)  # 出典
    is_simple = models.BooleanField(default=False)  # 簡単な例文かどうか
    
    def __str__(self):
        return f"{self.word.text}: {self.en[:50]}..."


class TextbookScope(models.Model):
    """教科書範囲モデル"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    word = models.ForeignKey(Word, on_delete=models.CASCADE, related_name='textbook_scopes')
    series = models.CharField(max_length=100, blank=True)  # シリーズ名
    edition = models.CharField(max_length=50, blank=True)  # 版
    unit = models.CharField(max_length=50, blank=True)  # ユニット
    range_note = models.CharField(max_length=200, blank=True)  # 範囲メモ
    
    def __str__(self):
        return f"{self.word.text} - {self.series} {self.edition} {self.unit}"


# 出題ログ（要件に合わせて更新）
class QuizSet(models.Model):
    """クイズセットモデル（要件準拠版）"""
    
    MODE_CHOICES = [
        ('EN2JA', '英語→日本語'),
        ('JA2EN', '日本語→英語'),
        ('default', '順番通り'),
        ('random', 'ランダム')
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='quiz_sets')
    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default='EN2JA')
    level = models.IntegerField(null=True, blank=True)
    segment = models.IntegerField(null=True, blank=True)
    question_count = models.IntegerField()
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    score = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['level', 'segment']),
        ]
    
    def __str__(self):
        return f"QuizSet {self.mode} L{self.level}-S{self.segment} ({self.user.email})"


class QuizItem(models.Model):
    """クイズアイテム（問題）モデル（要件準拠版）"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quiz_set = models.ForeignKey(QuizSet, on_delete=models.CASCADE, related_name='quiz_items')
    word = models.ForeignKey(Word, on_delete=models.RESTRICT)
    order = models.IntegerField()  # 問題の順序
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['quiz_set', 'order']),
        ]
        ordering = ['order']
    
    def __str__(self):
        return f"Item {self.order}: {self.word.text}"


class QuizResponse(models.Model):
    """クイズ回答モデル（要件準拠版）"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quiz_set = models.ForeignKey(QuizSet, on_delete=models.CASCADE, related_name='quiz_responses')
    quiz_item = models.ForeignKey(QuizItem, on_delete=models.CASCADE)
    selected_translation = models.ForeignKey(WordTranslation, on_delete=models.CASCADE, null=True, blank=True)
    is_correct = models.BooleanField()
    latency_ms = models.IntegerField()  # レイテンシ（ミリ秒）
    answered_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['quiz_set']),
            models.Index(fields=['answered_at']),
        ]
        constraints = [
            models.UniqueConstraint(fields=['quiz_set', 'quiz_item'], name='unique_quiz_response')
        ]
    
    def __str__(self):
        return f"Response: {self.quiz_item.word.text} - {'正解' if self.is_correct else '不正解'}"


# 既存の他のモデルも残す
class TeacherWhitelist(models.Model):
    """講師用メールホワイトリスト（DB管理）"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    note = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_whitelists')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['email']),
        ]

    def __str__(self):
        return self.email


class InviteCode(models.Model):
    """招待コード（認証コード）モデル"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=9, unique=True)
    issued_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='issued_codes')
    issued_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='used_codes')
    used_at = models.DateTimeField(null=True, blank=True)
    revoked = models.BooleanField(default=False)
    revoked_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['issued_by', 'issued_at']),
            models.Index(fields=['expires_at']),
        ]
    
    def __str__(self):
        return f"{self.code} (by {self.issued_by.email})"


class TeacherStudentLink(models.Model):
    """講師↔生徒紐付けモデル"""
    STATUS_CHOICES = [
        ('pending', '承認待ち'),
        ('active', '有効'),
        ('revoked', '解除済み'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='student_links')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='teacher_links')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    linked_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='revoked_links')
    invite_code = models.ForeignKey(InviteCode, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['teacher', 'student'], name='unique_teacher_student_link')
        ]
        indexes = [
            models.Index(fields=['teacher', 'status']),
            models.Index(fields=['student', 'status']),
            models.Index(fields=['linked_at']),
        ]
    
    def __str__(self):
        return f"{self.teacher.email} → {self.student.email} ({self.status})"
