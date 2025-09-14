from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
import uuid


class User(AbstractUser):
    """ユーザーモデル"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    display_name = models.CharField(max_length=100, blank=True)
    avatar = models.ImageField(blank=True, null=True, upload_to='avatars/')
    avatar_url = models.URLField(blank=True, null=True)
    # 追加: 講師の所属と自己紹介
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
        """平均スコアを計算"""
        if self.quiz_count == 0:
            return 0
        return (self.total_score / (self.quiz_count * 10)) * 100  # 仮定：各クイズ10問
    
    @property
    def is_teacher(self):
        """講師権限があるかどうか"""
        return self.role == 'teacher' or self.is_staff
    
    @property
    def is_admin_user(self):
        """管理者権限があるかどうか"""
        return self.role == 'admin' or self.is_superuser


class Word(models.Model):
    """英単語モデル"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    text = models.CharField(max_length=100)  # 英単語
    level = models.IntegerField(choices=[
        (1, 'レベル1'),
        (2, 'レベル2'),
        (3, 'レベル3'),
        (4, 'レベル4')
    ])
    segment = models.IntegerField(choices=[
        (1, 'セグメント1'),
        (2, 'セグメント2'),
        (3, 'セグメント3')
    ])
    difficulty = models.FloatField(default=0.5)  # 0.0-1.0の難易度
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['level', 'segment']),
            models.Index(fields=['difficulty']),
        ]
        unique_together = ['text', 'level', 'segment']
    
    def __str__(self):
        return f"{self.text} (L{self.level}-S{self.segment})"


class WordTranslation(models.Model):
    """単語翻訳モデル（選択肢）"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    word = models.ForeignKey(Word, on_delete=models.CASCADE, related_name='translations')
    text = models.CharField(max_length=200)  # 日本語訳
    is_correct = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['word', 'is_correct']),
        ]
    
    def __str__(self):
        return f"{self.text} ({'正解' if self.is_correct else '不正解'})"


class QuizSet(models.Model):
    """クイズセットモデル"""
    MODE_CHOICES = [
        ('default', '順番通り'),
        ('random', 'ランダム')
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='quiz_sets')
    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default='default')
    level = models.IntegerField(choices=[
        (1, 'レベル1'),
        (2, 'レベル2'),
        (3, 'レベル3'),
        (4, 'レベル4')
    ])
    segment = models.IntegerField(choices=[
        (1, 'セグメント1'),
        (2, 'セグメント2'),
        (3, 'セグメント3')
    ])
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
        return f"QuizSet L{self.level}-S{self.segment} ({self.user.email})"
    
    @property
    def total_duration_ms(self):
        """クイズの総所要時間（ミリ秒）"""
        if self.started_at and self.finished_at:
            return int((self.finished_at - self.started_at).total_seconds() * 1000)
        return 0


class QuizItem(models.Model):
    """クイズアイテム（問題）モデル"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quiz_set = models.ForeignKey(QuizSet, on_delete=models.CASCADE, related_name='quiz_items')
    word = models.ForeignKey(Word, on_delete=models.CASCADE)
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
    """クイズ回答モデル"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quiz_set = models.ForeignKey(QuizSet, on_delete=models.CASCADE, related_name='quiz_responses')
    quiz_item = models.ForeignKey(QuizItem, on_delete=models.CASCADE)
    selected_translation = models.ForeignKey(WordTranslation, on_delete=models.CASCADE)
    is_correct = models.BooleanField()
    reaction_time_ms = models.IntegerField()  # 反応時間（ミリ秒）
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['quiz_set']),
            models.Index(fields=['created_at']),
        ]
        unique_together = ['quiz_set', 'quiz_item']
    
    def __str__(self):
        return f"Response: {self.quiz_item.word.text} - {'正解' if self.is_correct else '不正解'}"


# 既存のモデルも残す（管理者機能用）
class Group(models.Model):
    """グループモデル（クラス・塾など）"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    owner_admin = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_groups')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class GroupMembership(models.Model):
    """グループメンバーシップモデル"""
    ROLE_CHOICES = [
        ('student', '生徒'),
        ('admin', '管理者'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='group_memberships')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['group', 'user']

    def __str__(self):
        return f"{self.user.email} - {self.group.name} ({self.role})"


class Question(models.Model):
    """問題モデル"""
    LEVEL_CHOICES = [
        ('basic', '基本'),
        ('intermediate', '中級'),
        ('advanced', '上級'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    text = models.TextField()  # 英単語
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES)
    segment = models.CharField(max_length=10)  # A, B, C, D等
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['level', 'segment']),
        ]

    def __str__(self):
        return f"{self.text} ({self.level}-{self.segment})"


class Option(models.Model):
    """選択肢モデル"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=200)  # 日本語訳
    is_correct = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['question', 'is_correct']),
        ]

    def __str__(self):
        return f"{self.text} ({'正解' if self.is_correct else '不正解'})"


class AssignedTest(models.Model):
    """配信されたテストモデル"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='assigned_tests')
    title = models.CharField(max_length=200)
    due_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} - {self.group.name}"


class QuizSession(models.Model):
    """クイズセッションモデル"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='quiz_sessions')
    test = models.ForeignKey(AssignedTest, on_delete=models.CASCADE, null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    total_time_ms = models.IntegerField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'started_at']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.started_at.strftime('%Y-%m-%d %H:%M')}"


class QuizResult(models.Model):
    """クイズ結果モデル"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(QuizSession, on_delete=models.CASCADE, related_name='results')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    chosen_option = models.ForeignKey(Option, on_delete=models.CASCADE, null=True, blank=True)
    is_correct = models.BooleanField()
    elapsed_ms = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['session']),
            models.Index(fields=['question']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.question.text} - {'正解' if self.is_correct else '不正解'}"


class DailyUserStats(models.Model):
    """日次ユーザー統計モデル"""
    date = models.DateField()
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='daily_stats')
    attempts = models.IntegerField(default=0)
    correct = models.IntegerField(default=0)
    total_time_ms = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['date', 'user']
        indexes = [
            models.Index(fields=['date', 'user']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.date}"


class DailyGroupStats(models.Model):
    """日次グループ統計モデル"""
    date = models.DateField()
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='daily_stats')
    attempts = models.IntegerField(default=0)
    correct = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['date', 'group']
        indexes = [
            models.Index(fields=['date', 'group']),
        ]

    def __str__(self):
        return f"{self.group.name} - {self.date}"


class InviteCode(models.Model):
    """招待コード（認証コード）モデル"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=9, unique=True)  # 'ABCD-EF12' 形式
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
    
    @property
    def is_expired(self):
        """期限切れかどうか"""
        return timezone.now() > self.expires_at
    
    @property
    def is_valid(self):
        """使用可能かどうか"""
        return not self.revoked and not self.is_expired and self.used_by is None
    
    @property
    def status(self):
        """状態を文字列で返す"""
        if self.revoked:
            return 'revoked'
        elif self.used_by:
            return 'used'
        elif self.is_expired:
            return 'expired'
        else:
            return 'active'


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
        unique_together = ['teacher', 'student']
        indexes = [
            models.Index(fields=['teacher', 'status']),
            models.Index(fields=['student', 'status']),
            models.Index(fields=['linked_at']),
        ]
    
    def __str__(self):
        return f"{self.teacher.email} → {self.student.email} ({self.status})"
