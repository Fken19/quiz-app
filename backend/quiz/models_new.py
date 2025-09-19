"""
新しいクイズ・英単語管理システムのモデル定義
目的：中学生向け英単語クイズ（4択/5択拡張対応）
構造：Level → Segment（10問固定） → Word
"""

from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
import uuid

# 既存のUserモデル、Groupモデルをインポート
from .models import User, Group, GroupMembership, TeacherStudentAlias, InviteCode, TeacherStudentLink, TeacherWhitelist


# ===== コアモデル（新スキーマ） =====

class Level(models.Model):
    """レベルモデル"""
    level_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    level_name = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'levels'
        
    def __str__(self):
        return self.level_name


class Segment(models.Model):
    """セグメントモデル（公開ワークフロー付き）"""
    PUBLISH_STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]
    
    segment_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    level_id = models.ForeignKey(Level, on_delete=models.CASCADE, db_column='level_id', related_name='segments')
    segment_name = models.TextField()
    publish_status = models.TextField(
        choices=PUBLISH_STATUS_CHOICES,
        default='draft'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'segments'
        constraints = [
            models.CheckConstraint(
                check=models.Q(publish_status__in=['draft', 'published', 'archived']),
                name='segments_publish_status_check'
            )
        ]
    
    def clean(self):
        """公開時は10問ちょうどである必要がある"""
        if self.publish_status == 'published':
            word_count = self.segment_words.count()
            if word_count != 10:
                raise ValidationError(f'Segment must have exactly 10 questions to publish (current: {word_count})')
    
    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.segment_name} ({self.publish_status})"


class NewWord(models.Model):
    """単語モデル"""
    word_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    text_en = models.TextField(unique=True)  # 英単語（一意制約）
    part_of_speech = models.TextField(blank=True, null=True)  # 品詞
    explanation = models.TextField(blank=True, null=True)  # 解説
    example_en = models.TextField(blank=True, null=True)  # 例文（英語）
    example_ja = models.TextField(blank=True, null=True)  # 例文（日本語）
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'words'
        indexes = [
            models.Index(fields=['text_en']),
            models.Index(fields=['created_at']),
        ]
        
    def __str__(self):
        return f"{self.text_en} ({self.part_of_speech or 'unknown'})"



class SegmentWord(models.Model):
    """セグメントに属する10問（順序1..10／重複禁止）"""
    segment_id = models.ForeignKey(Segment, on_delete=models.CASCADE, db_column='segment_id', related_name='segment_words')
    word_id = models.ForeignKey(NewWord, on_delete=models.RESTRICT, db_column='word_id', related_name='segment_words')
    question_order = models.IntegerField()
    
    class Meta:
        db_table = 'segment_words'
        constraints = [
            models.CheckConstraint(
                check=models.Q(question_order__gte=1, question_order__lte=10),
                name='segment_words_question_order_check'
            ),
            models.UniqueConstraint(
                fields=['segment_id', 'question_order'],
                name='segment_words_segment_order_unique'
            ),
            models.UniqueConstraint(
                fields=['segment_id', 'word_id'],
                name='segment_words_segment_word_unique'
            )
        ]
        
    def __str__(self):
        return f"{self.segment_id.segment_name} - Q{self.question_order}: {self.word_id.text_en}"


class NewWordTranslation(models.Model):
    """正答集合（辞書的な正解訳や同義語）"""
    word_translation_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    word_id = models.ForeignKey(NewWord, on_delete=models.CASCADE, db_column='word_id', related_name='translations')
    text_ja = models.TextField()  # 日本語訳
    is_correct = models.BooleanField(default=True)  # 常にtrue運用を推奨
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'word_translations'
        constraints = [
            models.UniqueConstraint(
                fields=['word_id', 'text_ja'],
                name='word_translations_word_text_unique'
            )
        ]
        
    def __str__(self):
        return f"{self.word_id.text_en}: {self.text_ja}"


class NewWordChoice(models.Model):
    """クイズ用選択肢プール（正解＋ダミー）"""
    word_choice_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    word_id = models.ForeignKey(NewWord, on_delete=models.CASCADE, db_column='word_id', related_name='choices')
    text_ja = models.TextField()  # 選択肢文言（正解/ダミー）
    is_correct = models.BooleanField()  # true=正解, false=ダミー
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'word_choices'
        constraints = [
            models.UniqueConstraint(
                fields=['word_id', 'text_ja'],
                name='word_choices_word_text_unique'
            )
        ]
        indexes = [
            models.Index(fields=['word_id'], name='ix_word_choices_word'),
            models.Index(fields=['word_id', 'is_correct'], name='ix_word_choices_word_correct'),
        ]
        
    def clean(self):
        """4択前提での健全性チェック（運用ルール）"""
        if hasattr(self, 'word_id') and self.word_id:
            correct_count = NewWordChoice.objects.filter(word_id=self.word_id, is_correct=True).count()
            dummy_count = NewWordChoice.objects.filter(word_id=self.word_id, is_correct=False).count()
            
            # 新規追加時のチェック
            if self.pk is None:
                if self.is_correct:
                    correct_count += 1
                else:
                    dummy_count += 1
            
            if correct_count < 1:
                raise ValidationError(f'Word {self.word_id.text_en} must have at least 1 correct choice')
            if dummy_count < 3:
                raise ValidationError(f'Word {self.word_id.text_en} must have at least 3 dummy choices')
    
    def __str__(self):
        return f"{self.word_id.text_en}: {self.text_ja} ({'正解' if self.is_correct else 'ダミー'})"


# ===== クイズセッション・結果モデル（新スキーマ対応） =====

class NewQuizSession(models.Model):
    """クイズセッションモデル（セグメントベース）"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='new_quiz_sessions')
    segment = models.ForeignKey(Segment, on_delete=models.CASCADE, related_name='quiz_sessions')
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    total_time_ms = models.IntegerField(null=True, blank=True)
    score = models.IntegerField(default=0)  # 正解数
    
    class Meta:
        db_table = 'quiz_new_quiz_sessions'
        indexes = [
            models.Index(fields=['user', 'started_at']),
            models.Index(fields=['segment']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.segment.segment_name} ({self.started_at.strftime('%Y-%m-%d %H:%M')})"
    
    @property
    def is_completed(self):
        """完了済みかどうか"""
        return self.completed_at is not None
    
    @property
    def score_percentage(self):
        """スコア（％）"""
        return (self.score / 10) * 100 if self.score is not None else 0


class NewQuizResult(models.Model):
    """クイズ結果モデル（問題単位）"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(NewQuizSession, on_delete=models.CASCADE, related_name='results')
    word = models.ForeignKey(NewWord, on_delete=models.CASCADE)
    question_order = models.IntegerField()  # セグメント内の問題順序
    selected_choice = models.ForeignKey(NewWordChoice, on_delete=models.CASCADE, null=True, blank=True)
    selected_text = models.TextField()  # 選択した回答テキスト
    is_correct = models.BooleanField()
    reaction_time_ms = models.IntegerField(null=True, blank=True)  # 反応時間
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'quiz_new_quiz_results'
        indexes = [
            models.Index(fields=['session']),
            models.Index(fields=['word']),
            models.Index(fields=['created_at']),
        ]
        unique_together = ['session', 'question_order']

    def __str__(self):
        return f"{self.word.text_en} - {'正解' if self.is_correct else '不正解'}"


# ===== 統計・分析モデル =====

class NewDailyUserStats(models.Model):
    """日次ユーザー統計モデル"""
    date = models.DateField()
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='new_daily_stats')
    sessions_count = models.IntegerField(default=0)  # セッション数
    questions_attempted = models.IntegerField(default=0)  # 挑戦問題数
    questions_correct = models.IntegerField(default=0)  # 正解問題数
    total_time_ms = models.IntegerField(default=0)  # 総時間
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'quiz_new_dailyuserstats'
        unique_together = ['date', 'user']
        indexes = [
            models.Index(fields=['date', 'user']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.date}"


class NewDailyGroupStats(models.Model):
    """日次グループ統計モデル"""
    date = models.DateField()
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='new_daily_stats')
    sessions_count = models.IntegerField(default=0)
    questions_attempted = models.IntegerField(default=0)
    questions_correct = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'quiz_new_dailygroupstats'
        unique_together = ['date', 'group']
        indexes = [
            models.Index(fields=['date', 'group']),
        ]

    def __str__(self):
        return f"{self.group.name} - {self.date}"


# ===== レガシー互換モデル（既存APIとの互換性維持） =====

class LegacyQuizSet(models.Model):
    """レガシーQuizSetモデル（既存APIとの互換性維持）"""
    id = models.BigAutoField(primary_key=True, db_column='id')
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, db_column='uuid')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='legacy_quiz_sets', db_column='user_id')
    name = models.CharField(max_length=255, db_column='name')
    # 新スキーマとの関連付け
    quiz_session = models.OneToOneField(NewQuizSession, on_delete=models.CASCADE, null=True, blank=True, related_name='legacy_quiz_set')
    created_at = models.DateTimeField(auto_now_add=True, db_column='created_at')
    updated_at = models.DateTimeField(auto_now=True, db_column='updated_at')
    
    class Meta:
        db_table = 'quiz_quiz_set'
        managed = False  # 既存テーブルなので管理しない
    
    def __str__(self):
        return f"LegacyQuizSet: {self.name}"
    
    # 後方互換性のためのプロパティ
    @property
    def score(self):
        """スコア（新スキーマから計算）"""
        if self.quiz_session:
            return self.quiz_session.score
        return 0
    
    @property
    def total_questions(self):
        """総問題数（常に10問）"""
        return 10


class LegacyQuizItem(models.Model):
    """レガシーQuizItemモデル（既存APIとの互換性維持）"""
    id = models.BigAutoField(primary_key=True, db_column='id')
    quiz_set = models.ForeignKey(LegacyQuizSet, on_delete=models.CASCADE, related_name='quiz_items', db_column='quiz_set_id')
    # 新スキーマとの関連付け
    quiz_result = models.OneToOneField(NewQuizResult, on_delete=models.CASCADE, null=True, blank=True, related_name='legacy_quiz_item')
    question_number = models.IntegerField(db_column='question_number')
    choices = models.JSONField(blank=True, null=True, db_column='choices')
    correct_answer = models.CharField(max_length=255, db_column='correct_answer')
    created_at = models.DateTimeField(auto_now_add=True, db_column='created_at')
    updated_at = models.DateTimeField(auto_now=True, db_column='updated_at')
    
    class Meta:
        ordering = ['question_number']
        db_table = 'quiz_quiz_item'
        managed = False  # 既存テーブルなので管理しない
    
    def __str__(self):
        return f"LegacyQuizItem #{self.question_number}"
    
    @property
    def word(self):
        """単語（新スキーマから取得）"""
        if self.quiz_result:
            return self.quiz_result.word
        return None


class LegacyQuizResponse(models.Model):
    """レガシーQuizResponseモデル（既存APIとの互換性維持）
    実際のDBは user_id や selected_answer カラムを持たず、quiz_set を経由し selected_translation_id を参照します。
    そのためここでは実テーブルに合わせたフィールド定義を行い、managed=False とします。
    """
    id = models.BigAutoField(primary_key=True, db_column='id')
    quiz_item = models.ForeignKey(LegacyQuizItem, on_delete=models.CASCADE, db_column='quiz_item_id')
    # user は quiz_set を経由して参照されるため、quiz_set を定義
    quiz_set = models.ForeignKey('quiz.QuizSet', on_delete=models.CASCADE, db_column='quiz_set_id')
    # 選択は selected_translation_id として参照される
    selected_translation = models.ForeignKey('quiz.WordTranslation', on_delete=models.SET_NULL, null=True, blank=True, db_column='selected_translation_id')
    is_correct = models.BooleanField(db_column='is_correct')
    # DB 側のカラム名は 'reaction_time_ms'
    reaction_time_ms = models.IntegerField(db_column='reaction_time_ms')
    created_at = models.DateTimeField(auto_now_add=True, db_column='created_at')
    updated_at = models.DateTimeField(auto_now=True, db_column='updated_at')

    class Meta:
        # actual legacy table name in DB
        db_table = 'quiz_quizresponse'
        managed = False  # 既存テーブルなので管理しない

    def __str__(self):
        return f"LegacyResponse: {'正解' if self.is_correct else '不正解'}"

    @property
    def user(self):
        try:
            return self.quiz_set.user
        except Exception:
            return None

    @property
    def selected_answer(self):
        try:
            return getattr(self.selected_translation, 'text', '')
        except Exception:
            return ''
