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
    """英単語モデル — 現在の DB スキーマ (lemma/pos/grade/frequency) に合わせてマッピングしています"""
    # DB 側は bigint identity を主キーとしているため BigAutoField を使用
    id = models.BigAutoField(primary_key=True, db_column='id')
    # model attribute name kept as `text` for code readability, but stored in DB column `lemma`
    text = models.CharField(max_length=100, db_column='lemma')
    pos = models.CharField(max_length=20, db_column='pos')
    # grade stored as integer in DB
    grade = models.IntegerField(db_column='grade')
    # frequency (existing DB column)
    frequency = models.IntegerField(default=1, db_column='frequency')
    created_at = models.DateTimeField(auto_now_add=True, db_column='created_at')
    updated_at = models.DateTimeField(auto_now=True, db_column='updated_at')
    
    class Meta:
        indexes = [
            models.Index(fields=['grade'], name='quiz_word_grade_idx'),
            # use model field name 'text' (db_column='lemma') for indexes
            models.Index(fields=['text'], name='quiz_word_lemma_idx'),
        ]
        unique_together = ['text', 'pos']
    
    def __str__(self):
        return f"{self.text} ({self.pos}) G{self.grade}"


class WordTranslation(models.Model):
    """訳語モデル — DB の既存カラム (translation, is_primary, context) に合わせる"""
    id = models.BigAutoField(primary_key=True, db_column='id')
    word = models.ForeignKey(Word, on_delete=models.CASCADE, related_name='translations', db_column='word_id')
    # keep attribute name `text` for compatibility in code, map to DB column `translation`
    text = models.CharField(max_length=200, db_column='translation')
    # DB uses `is_primary` to mark main translation; map to model boolean field
    is_correct = models.BooleanField(default=False, db_column='is_primary')
    # some older schema has a context column which is NOT NULL
    context = models.CharField(max_length=500, blank=True, default='', db_column='context')
    created_at = models.DateTimeField(auto_now_add=True, db_column='created_at')
    updated_at = models.DateTimeField(auto_now=True, db_column='updated_at')

    class Meta:
        db_table = 'quiz_word_translation'
        indexes = [
            models.Index(fields=['word', 'is_correct'], name='quiz_wordtr_word_id_3968a8_idx'),
        ]

    def __str__(self):
        return f"{self.text} ({'主訳' if self.is_correct else '偽訳'})"


class QuizSet(models.Model):
    """クイズセットモデル - 実際のDBスキーマに合わせて修正"""
    
    # 実際のDBはbigintのIDENTITY + UUIDの両方を持っている
    id = models.BigAutoField(primary_key=True, db_column='id')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='quiz_sets', db_column='user_id')
    grade = models.IntegerField(db_column='grade')
    pos_filter = models.JSONField(blank=True, null=True, db_column='pos_filter')
    total_questions = models.IntegerField(db_column='total_questions')
    textbook_scope_id = models.BigIntegerField(null=True, blank=True, db_column='textbook_scope_id')
    created_at = models.DateTimeField(auto_now_add=True, db_column='created_at')
    updated_at = models.DateTimeField(auto_now=True, db_column='updated_at')
    
    class Meta:
        db_table = 'quiz_quiz_set'
    
    def __str__(self):
        return f"QuizSet #{self.id} (Grade {self.grade})"
    
    # 後方互換性のためのプロパティ
    @property
    def mode(self):
        """後方互換性: modeプロパティ"""
        return 'default'  # デフォルト値
    
    @property
    def level(self):
        """後方互換性: levelプロパティ"""
        return self.grade
    
    @property
    def segment(self):
        """後方互換性: segmentプロパティ"""
        return 1  # デフォルト値
    
    @property
    def question_count(self):
        """後方互換性: question_countプロパティ"""
        return self.total_questions
    
    @property
    def score(self):
        """スコア計算"""
        # 関連するQuizResponseから計算
        responses = self.get_quiz_responses()
        if responses.exists():
            correct_count = responses.filter(is_correct=True).count()
            return correct_count
        return 0
    
    @property
    def started_at(self):
        """開始時刻: created_atをベースに"""
        return self.created_at
    
    @property
    def finished_at(self):
        """終了時刻: updated_atをベースに"""
        return self.updated_at
    
    @property
    def total_duration_ms(self):
        """クイズの総所要時間（ミリ秒）"""
        if self.started_at and self.finished_at:
            return int((self.finished_at - self.started_at).total_seconds() * 1000)
        return 0
    
    def get_quiz_responses(self):
        """このQuizSetに関連するすべてのQuizResponseを取得"""
        # Propertyではなくメソッドとして実装し、必要な時のみ呼び出す
        return QuizResponse.objects.filter(quiz_item__quiz_set=self)


class QuizItem(models.Model):
    """クイズアイテム（問題）モデル - 実際のDBスキーマに合わせて修正"""
    id = models.BigAutoField(primary_key=True, db_column='id')
    quiz_set = models.ForeignKey(QuizSet, on_delete=models.CASCADE, related_name='quiz_items', db_column='quiz_set_id')
    word = models.ForeignKey(Word, on_delete=models.CASCADE, db_column='word_id')
    question_number = models.IntegerField(db_column='question_number')  # 問題の順序
    choices = models.JSONField(blank=True, null=True, db_column='choices')  # 選択肢
    correct_answer = models.CharField(max_length=255, db_column='correct_answer')  # 正答
    created_at = models.DateTimeField(auto_now_add=True, db_column='created_at')
    updated_at = models.DateTimeField(auto_now=True, db_column='updated_at')
    
    class Meta:
        ordering = ['question_number']
        db_table = 'quiz_quiz_item'
    
    def __str__(self):
        return f"Item {self.question_number}: {self.word.text if hasattr(self, 'word') and self.word else 'No word'}"
    
    # 後方互換性のためのプロパティ
    @property
    def order(self):
        """後方互換性: orderプロパティ"""
        return self.question_number


class QuizResponse(models.Model):
    """クイズ回答モデル"""
    # DBの主キーはbigintのIDENTITY
    id = models.BigAutoField(primary_key=True, db_column='id')
    # quiz_setへの直接参照は存在しない（quiz_itemを経由してアクセス）
    quiz_item = models.ForeignKey(QuizItem, on_delete=models.CASCADE, db_column='quiz_item_id')
    # selected_answerカラムに対応（文字列として保存）
    selected_answer = models.CharField(max_length=200, db_column='selected_answer')
    is_correct = models.BooleanField(db_column='is_correct')
    reaction_time_ms = models.IntegerField(db_column='response_time_ms')  # 反応時間（ミリ秒）
    # ユーザーへの直接参照が存在
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column='user_id')
    created_at = models.DateTimeField(auto_now_add=True, db_column='created_at')
    updated_at = models.DateTimeField(auto_now=True, db_column='updated_at')
    
    class Meta:
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['created_at']),
        ]
        # DBの制約に合わせる（quiz_item_idがユニーク制約）
        # unique_together = ['quiz_set', 'quiz_item']  # quiz_setが存在しないため削除
        # 実際の DB テーブル名は quiz_quiz_response
        db_table = 'quiz_quiz_response'
    
    @property
    def quiz_set(self):
        """quiz_itemを経由してquiz_setにアクセス"""
        return self.quiz_item.quiz_set
    
    @property 
    def selected_translation(self):
        """後方互換性のため、selected_answerをWordTranslationとして解釈"""
        # 実装は必要に応じて追加（現在は文字列として保存されている）
        return None
    
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

    class Meta:
        unique_together = ['owner_admin', 'name']
        indexes = [
            models.Index(fields=['owner_admin']),
            models.Index(fields=['name']),
        ]

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
    # グループ内でのみ利用する管理属性（最大2つ）
    attr1 = models.CharField(max_length=100, blank=True, default='')
    attr2 = models.CharField(max_length=100, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['group', 'user']

    def __str__(self):
        return f"{self.user.email} - {self.group.name} ({self.role})"


class TeacherStudentAlias(models.Model):
    """講師が生徒に対して付ける表示名（講師専用のローカルエイリアス）"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='student_aliases')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='teacher_aliases')
    alias_name = models.CharField(max_length=100)
    note = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['teacher', 'student']
        indexes = [
            models.Index(fields=['teacher']),
            models.Index(fields=['student']),
        ]

    def __str__(self):
        return f"{self.teacher.email} -> {self.student.email}: {self.alias_name}"


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
    # オプション: テンプレートと制限時間（秒）。先にテンプレートを保存してから割当で紐付ける想定。
    template = models.ForeignKey('quiz.TestTemplate', on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tests')
    timer_seconds = models.IntegerField(null=True, blank=True)
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


class TeacherWhitelist(models.Model):
    """講師用メールホワイトリスト（最小構成: メール中心）
    既存テーブル quiz_whitelist_user にマップ。
    使用カラム: id(uuid), email, note(任意), created_at, created_by
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column='id')
    email = models.EmailField(unique=True, db_column='email')
    note = models.CharField(max_length=200, blank=True, db_column='note')
    created_at = models.DateTimeField(auto_now_add=True, db_column='created_at')
    created_by = models.ForeignKey('quiz.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_whitelists', db_column='created_by_id')

    class Meta:
        db_table = 'quiz_whitelist_user'
        indexes = [models.Index(fields=['email'])]

    def __str__(self):
        return self.email


# --- テスト作成テンプレート（講師向け） ---
class TestTemplate(models.Model):
    """講師が再利用できるテストテンプレート
    単語ベースで問題を構成。選択肢（ダミー）は項目側のJSONに保持。
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='test_templates')
    title = models.CharField(max_length=200)
    description = models.CharField(max_length=500, blank=True)
    # オプション: テスト時のみ適用するタイマー（秒）
    default_timer_seconds = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['owner', 'created_at']),
        ]

    def __str__(self):
        return f"{self.title} (by {self.owner.display_name or self.owner.email})"


class TestTemplateItem(models.Model):
    """テンプレートの各問題項目
    既存の Word を参照し、選択肢候補（ダミー含む）を JSON で保持。
    choices 例: [{"text": "訳1", "is_correct": false}, ...]
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(TestTemplate, on_delete=models.CASCADE, related_name='items')
    word = models.ForeignKey(Word, on_delete=models.CASCADE, db_column='word_id')
    order = models.IntegerField(default=0)
    choices = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']
        indexes = [
            models.Index(fields=['template', 'order']),
        ]

    def __str__(self):
        return f"{self.template.title} - #{self.order}: {self.word.text}"
