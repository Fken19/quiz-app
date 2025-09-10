from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
import uuid


class User(AbstractUser):
    """ユーザーモデル"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    display_name = models.CharField(max_length=100, blank=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.email or self.username


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
