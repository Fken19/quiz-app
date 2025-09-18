from rest_framework import serializers
from .models import (
    User, Word, WordTranslation, QuizSet, QuizItem, QuizResponse, Group,
    InviteCode, TeacherStudentLink, GroupMembership, TeacherStudentAlias,
    TestTemplate, TestTemplateItem, AssignedTest,
    Question, Option, QuizSession, QuizResult
)
from .utils import generate_invite_code, normalize_invite_code, get_code_expiry_time


class UserSerializer(serializers.ModelSerializer):
    average_score = serializers.ReadOnlyField()
    # avatar field: if ImageField exists on model, include its URL
    avatar = serializers.ImageField(read_only=True)
    avatar_url = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'display_name', 'organization', 'bio', 'avatar', 'avatar_url', 'role', 'created_at',
            'last_login', 'level_preference', 'quiz_count', 'total_score', 'average_score'
        ]
        read_only_fields = ['id', 'created_at', 'quiz_count', 'total_score', 'average_score']

    def get_avatar_url(self, obj):
        # prefer avatar (ImageField) URL if available, otherwise avatar_url text field
        try:
            if getattr(obj, 'avatar') and hasattr(obj.avatar, 'url'):
                # If serializer has context with request, build absolute URI
                request = self.context.get('request') if hasattr(self, 'context') else None
                url = obj.avatar.url
                if request:
                    return request.build_absolute_uri(url)
                return url
        except Exception:
            pass
        # fallback to avatar_url field, ensure absolute URL if possible
        avatar_url = getattr(obj, 'avatar_url', None)
        request = self.context.get('request') if hasattr(self, 'context') else None
        if avatar_url:
            if request and not avatar_url.startswith('http'):
                return request.build_absolute_uri(avatar_url)
            return avatar_url
        return None


class MinimalUserSerializer(serializers.ModelSerializer):
    """メールを返さない講師向けの最小ユーザー表示用"""
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'display_name', 'avatar_url', 'role', 'created_at']

    def get_avatar_url(self, obj):
        try:
            if getattr(obj, 'avatar') and hasattr(obj.avatar, 'url'):
                request = self.context.get('request') if hasattr(self, 'context') else None
                url = obj.avatar.url
                return request.build_absolute_uri(url) if request else url
        except Exception:
            pass
        url = getattr(obj, 'avatar_url', None)
        if url:
            request = self.context.get('request') if hasattr(self, 'context') else None
            if request and not url.startswith('http'):
                return request.build_absolute_uri(url)
            return url
        return None


class WordTranslationSerializer(serializers.ModelSerializer):
    ja = serializers.CharField(source='text', read_only=True)
    # DBはBigAutoField(int)なので整合する型にする
    word_id = serializers.IntegerField(source='word.id', read_only=True)

    class Meta:
        model = WordTranslation
        fields = ['id', 'word_id', 'ja', 'is_correct']


class PublicWordTranslationSerializer(serializers.ModelSerializer):
    """API の公開用: is_correct を含めない"""
    ja = serializers.CharField(source='text', read_only=True)
    word_id = serializers.IntegerField(source='word.id', read_only=True)

    class Meta:
        model = WordTranslation
        fields = ['id', 'word_id', 'ja']


class InternalWordTranslationSerializer(serializers.ModelSerializer):
    """内部/履歴用: is_correct を含む"""
    ja = serializers.CharField(source='text', read_only=True)
    word_id = serializers.IntegerField(source='word.id', read_only=True)

    class Meta:
        model = WordTranslation
        fields = ['id', 'word_id', 'ja', 'is_correct']


class WordSerializer(serializers.ModelSerializer):
    # 公開 API では is_correct を返さないので Public serializer を使用
    translations = PublicWordTranslationSerializer(many=True, read_only=True)
    
    # 後方互換性のため
    level = serializers.SerializerMethodField()
    segment = serializers.SerializerMethodField()
    difficulty = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()  # DB に name 列がない環境でも動くようにタイトルを動的生成
    def get_level(self, obj):
        return obj.grade  # gradeをlevelとして返す

    def get_segment(self, obj):
        return 1  # デフォルト値

    def get_difficulty(self, obj):
        return obj.grade  # gradeを基にした難易度

    class Meta:
        model = Word
        fields = ['id', 'text', 'level', 'segment', 'difficulty', 'translations']


class QuizItemSerializer(serializers.ModelSerializer):
    word = WordSerializer(read_only=True)
    # フロントは quizItem.translations を期待するのでここで flatten して返す
    translations = serializers.SerializerMethodField()
    
    def get_title(self, obj):
        # 可能なら name を使用（開発環境等で列が存在する場合への互換）
        name = getattr(obj, 'name', None)
        if name:
            return name
        # フォールバック: レベルと問数からタイトル生成
        try:
            return f"Level {getattr(obj, 'grade', 'N/A')} - {getattr(obj, 'total_questions', 0)}問"
        except Exception:
            return f"QuizSet #{getattr(obj, 'id', '')}"
    # フロント側の型名に合わせて order_no を出力
    order_no = serializers.IntegerField(source='order', read_only=True)
    # デバッグ/フォールバック用にchoicesも返す（通常は使用しない）
    choices = serializers.JSONField(read_only=True)

    class Meta:
        model = QuizItem
        fields = ['id', 'word', 'translations', 'order_no', 'choices']

    def get_translations(self, obj):
        # 通常は Word に紐づく翻訳を返す
        translations_qs = obj.word.translations.all()
        if translations_qs.exists():
            return PublicWordTranslationSerializer(translations_qs, many=True).data
        
        # フォールバック: DB上に翻訳が無い単語の場合、QuizItem.choices から生成
        out = []
        for i, ch in enumerate((obj.choices or [])):
            out.append({
                'id': f'c{i}',  # 疑似ID（サーバー送信時は selected_text を使用）
                'word_id': obj.word.id,
                'ja': ch.get('text', ''),
                'is_correct': bool(ch.get('is_correct', False)),
            })
        return out


class QuizResponseSerializer(serializers.ModelSerializer):
    quiz_item = QuizItemSerializer(read_only=True)
    # selected_answerは文字列として保存されている
    selected_answer = serializers.CharField(read_only=True)
    # 後方互換性のため、selected_translationフィールドを追加
    selected_translation = serializers.SerializerMethodField()
    user = UserSerializer(read_only=True)

    class Meta:
        model = QuizResponse
        fields = [
            'id', 'quiz_item', 'selected_answer', 'selected_translation', 
            'reaction_time_ms', 'is_correct', 'user', 'created_at'
        ]
    
    def get_selected_translation(self, obj):
        # 後方互換性のため、selected_answerを翻訳オブジェクトとして返す
        return {
            'id': None,
            'word_id': None,
            'ja': obj.selected_answer,
            'is_correct': obj.is_correct
        }


class QuizSetSerializer(serializers.ModelSerializer):
    quiz_items = QuizItemSerializer(many=True, read_only=True)
    # QuizSet から直接の related_name はないため、明示的に取得
    quiz_responses = serializers.SerializerMethodField()
    total_duration_ms = serializers.ReadOnlyField()
    
    class Meta:
        model = QuizSet
        fields = [
            'id', 'mode', 'level', 'segment', 'question_count', 'started_at', 
            'finished_at', 'score', 'created_at', 'quiz_items', 'quiz_responses',
            'total_duration_ms'
        ]
        read_only_fields = ['id', 'created_at', 'total_duration_ms']

    def get_quiz_responses(self, obj):
        from .models import QuizResponse
        qs = QuizResponse.objects.filter(quiz_item__quiz_set=obj).order_by('created_at')
        return QuizResponseSerializer(qs, many=True, context=self.context).data


class QuizSetCreateSerializer(serializers.ModelSerializer):
    # フロントエンドから受け取るフィールド
    level = serializers.IntegerField()
    segment = serializers.IntegerField()
    question_count = serializers.IntegerField()
    mode = serializers.CharField(default='default')
    
    class Meta:
        model = QuizSet
        fields = ['mode', 'level', 'segment', 'question_count']
    
    def create(self, validated_data):
        # デバッグ用ログ
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"QuizSetCreateSerializer.create called with validated_data: {validated_data}")
        
        # フロントエンドのフィールドを実際のDBフィールドにマッピング
        level = validated_data.pop('level', 1)
        segment = validated_data.pop('segment', 1)
        question_count = validated_data.pop('question_count', 10)
        mode = validated_data.pop('mode', 'default')
        
        logger.info(f"Extracted values - level: {level}, segment: {segment}, question_count: {question_count}, mode: {mode}")
        
        # validated_dataから残りのフィールドをクリア（互換性のないフィールドを削除）
        validated_data.clear()
        
        # QuizSetの作成
        quiz_set = QuizSet.objects.create(
            user=self.context['request'].user,
            grade=level,  # levelをgradeにマッピング
            total_questions=question_count,  # question_countをtotal_questionsにマッピング
            pos_filter={}  # 空のJSONオブジェクト
        )
        logger.info(f"Created QuizSet: {quiz_set.id}")
        return quiz_set


class QuizResponseCreateSerializer(serializers.Serializer):
    # DBのIDは整数
    quiz_item_id = serializers.IntegerField()
    selected_translation_id = serializers.IntegerField()
    reaction_time_ms = serializers.IntegerField()


class QuizResultSerializer(serializers.Serializer):
    """クイズ結果のレスポンス用シリアライザー"""
    quiz_set = QuizSetSerializer()
    quiz_items = QuizItemSerializer(many=True)
    quiz_responses = QuizResponseSerializer(many=True)
    total_score = serializers.IntegerField()
    total_questions = serializers.IntegerField()
    total_duration_ms = serializers.IntegerField()
    average_latency_ms = serializers.FloatField()


class QuizSetListSerializer(serializers.ModelSerializer):
    """クイズセット一覧用のシリアライザー"""
    item_count = serializers.SerializerMethodField()
    completion_rate = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()  # name 列がなくてもOK
    difficulty = serializers.SerializerMethodField()
    times_attempted = serializers.SerializerMethodField()

    def get_difficulty(self, obj):
        return obj.grade  # gradeを難易度として返す

    def get_times_attempted(self, obj):
        return 0  # 後で実装

    class Meta:
        model = QuizSet
        fields = ['id', 'title', 'difficulty', 'created_at', 'times_attempted', 'item_count', 'completion_rate']

    def get_item_count(self, obj):
        return obj.quiz_items.count()

    def get_completion_rate(self, obj):
        # ユーザーの回答率を計算
        user = self.context.get('request').user if self.context.get('request') else None
        if user and not user.is_anonymous:
            total_items = obj.quiz_items.count()
            answered_items = QuizResponse.objects.filter(
                quiz_item__quiz_set=obj,
            )
            # 回答者が指定ユーザのもののみをカウント
            answered_items = answered_items.filter(user=user).count() if hasattr(QuizResponse, 'user') else QuizResponse.objects.filter(quiz_item__quiz_set=obj).count()
            return (answered_items / total_items * 100) if total_items > 0 else 0
        return 0

    def get_title(self, obj):
        nm = getattr(obj, 'name', None)
        if nm:
            return nm
        return f"Level {getattr(obj, 'grade', 'N/A')} - {getattr(obj, 'total_questions', 0)}問"


class DashboardStatsSerializer(serializers.Serializer):
    """ダッシュボード統計用のシリアライザー"""
    total_quizzes = serializers.IntegerField()
    average_score = serializers.FloatField()
    current_streak = serializers.IntegerField()
    weekly_activity = serializers.IntegerField()
    level = serializers.IntegerField()
    monthly_progress = serializers.FloatField()
    recent_quiz_sets = QuizSetListSerializer(many=True)


# 管理者機能用のシリアライザー（既存）
class GroupSerializer(serializers.ModelSerializer):
    owner_admin = UserSerializer(read_only=True)
    
    class Meta:
        model = Group
        fields = ['id', 'name', 'owner_admin', 'created_at']


class GroupCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ['name']


class GroupMembershipSerializer(serializers.ModelSerializer):
    # メール非表示のため最小ユーザー情報のみ
    user = MinimalUserSerializer(read_only=True)
    alias_name = serializers.SerializerMethodField()
    effective_name = serializers.SerializerMethodField()
    # 管理属性
    attr1 = serializers.CharField(read_only=True)
    attr2 = serializers.CharField(read_only=True)

    class Meta:
        model = GroupMembership
        fields = ['id', 'group', 'user', 'role', 'created_at', 'alias_name', 'effective_name', 'attr1', 'attr2']
        read_only_fields = ['id', 'created_at', 'group', 'user']

    def get_alias_name(self, obj):
        request = self.context.get('request') if hasattr(self, 'context') else None
        teacher = getattr(request, 'user', None)
        if not teacher or getattr(teacher, 'is_anonymous', False):
            return None
        alias = TeacherStudentAlias.objects.filter(teacher=teacher, student=obj.user).first()
        return alias.alias_name if alias else None

    def get_effective_name(self, obj):
        alias = self.get_alias_name(obj)
        if alias:
            return alias
        return obj.user.display_name or '生徒'


class GroupMembershipAttributesUpdateSerializer(serializers.Serializer):
    attr1 = serializers.CharField(max_length=100, allow_blank=True, required=False)
    attr2 = serializers.CharField(max_length=100, allow_blank=True, required=False)


class GroupRankingItemSerializer(serializers.Serializer):
    user = MinimalUserSerializer()
    value = serializers.FloatField()
    period = serializers.ChoiceField(choices=['daily', 'weekly', 'monthly'])
    metric = serializers.CharField()


class TeacherStudentAliasSerializer(serializers.ModelSerializer):
    teacher = UserSerializer(read_only=True)
    student = UserSerializer(read_only=True)

    class Meta:
        model = TeacherStudentAlias
        fields = ['id', 'teacher', 'student', 'alias_name', 'note', 'created_at', 'updated_at']
        read_only_fields = ['id', 'teacher', 'student', 'created_at', 'updated_at']


class UpsertAliasSerializer(serializers.Serializer):
    student_id = serializers.UUIDField()
    alias_name = serializers.CharField(max_length=100)
    note = serializers.CharField(max_length=200, allow_blank=True, required=False)


class SearchStudentsSerializer(serializers.Serializer):
    q = serializers.CharField(max_length=100, required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=['active', 'pending', 'all'], required=False, default='active')


# 招待コード関連シリアライザー
class InviteCodeSerializer(serializers.ModelSerializer):
    issued_by = UserSerializer(read_only=True)
    used_by = UserSerializer(read_only=True)
    status = serializers.ReadOnlyField()
    is_valid = serializers.ReadOnlyField()
    is_expired = serializers.ReadOnlyField()
    
    class Meta:
        model = InviteCode
        fields = [
            'id', 'code', 'issued_by', 'issued_at', 'expires_at',
            'used_by', 'used_at', 'revoked', 'revoked_at',
            'status', 'is_valid', 'is_expired'
        ]
        read_only_fields = [
            'id', 'issued_at', 'used_by', 'used_at', 'revoked_at'
        ]


class CreateInviteCodeSerializer(serializers.Serializer):
    count = serializers.IntegerField(default=1, min_value=1, max_value=50)
    expires_hours = serializers.IntegerField(default=1, min_value=1, max_value=24)
    
    def create(self, validated_data):
        user = self.context['request'].user
        count = validated_data['count']
        expires_hours = validated_data['expires_hours']
        
        codes = []
        for _ in range(count):
            # ユニークなコードを生成
            code = generate_invite_code()
            while InviteCode.objects.filter(code=code).exists():
                code = generate_invite_code()
            
            invite_code = InviteCode.objects.create(
                code=code,
                issued_by=user,
                expires_at=get_code_expiry_time(expires_hours)
            )
            codes.append(invite_code)
        
        return codes


class AcceptInviteCodeSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=9)
    agreed = serializers.BooleanField(default=False)
    
    def validate_code(self, value):
        normalized = normalize_invite_code(value)
        if not normalized:
            raise serializers.ValidationError('無効なコード形式です')
        return normalized
    
    def validate(self, attrs):
        if not attrs.get('agreed'):
            raise serializers.ValidationError({'agreed': 'データ閲覧に同意する必要があります'})
        
        code = attrs['code']
        try:
            invite_code = InviteCode.objects.get(code=code)
        except InviteCode.DoesNotExist:
            raise serializers.ValidationError({'code': '無効なコードです'})
        
        if not invite_code.is_valid:
            if invite_code.revoked:
                raise serializers.ValidationError({'code': 'このコードは無効化されています'})
            elif invite_code.used_by:
                raise serializers.ValidationError({'code': 'このコードは既に使用済みです'})
            elif invite_code.is_expired:
                raise serializers.ValidationError({'code': '期限切れのコードです'})
        
        attrs['invite_code'] = invite_code
        return attrs


# 講師↔生徒紐付け関連シリアライザー
class TeacherStudentLinkSerializer(serializers.ModelSerializer):
    teacher = UserSerializer(read_only=True)
    student = UserSerializer(read_only=True)
    revoked_by = UserSerializer(read_only=True)
    
    class Meta:
        model = TeacherStudentLink
        fields = [
            'id', 'teacher', 'student', 'status', 'linked_at',
            'revoked_at', 'revoked_by'
        ]
        read_only_fields = ['id', 'linked_at', 'revoked_at', 'revoked_by']


# --- テストテンプレート ---
class TestTemplateItemSerializer(serializers.ModelSerializer):
    word_id = serializers.IntegerField(source='word.id')
    word_text = serializers.CharField(source='word.text', read_only=True)

    class Meta:
        model = TestTemplateItem
        fields = ['id', 'order', 'word_id', 'word_text', 'choices']
        read_only_fields = ['id', 'word_text']


class TestTemplateSerializer(serializers.ModelSerializer):
    owner = MinimalUserSerializer(read_only=True)
    items = TestTemplateItemSerializer(many=True)
    default_timer_seconds = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = TestTemplate
        fields = ['id', 'title', 'description', 'default_timer_seconds', 'owner', 'items', 'created_at', 'updated_at']
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at']

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        template = TestTemplate.objects.create(owner=self.context['request'].user, **validated_data)
        # バルク作成（順序確定）
        objs = []
        for i, item in enumerate(items_data, start=1):
            word_id = item.get('word', {}).get('id') or item.get('word_id')
            objs.append(TestTemplateItem(template=template, word_id=word_id, order=item.get('order', i), choices=item.get('choices')))
        if objs:
            TestTemplateItem.objects.bulk_create(objs)
        return template

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if items_data is not None:
            # 全削除→再作成（簡易）
            instance.items.all().delete()
            objs = []
            for i, item in enumerate(items_data, start=1):
                word_id = item.get('word', {}).get('id') or item.get('word_id')
                objs.append(TestTemplateItem(template=instance, word_id=word_id, order=item.get('order', i), choices=item.get('choices')))
            if objs:
                TestTemplateItem.objects.bulk_create(objs)
        return instance


class AssignedTestSerializer(serializers.ModelSerializer):
    template_id = serializers.UUIDField(source='template.id', allow_null=True, required=False)
    group_id = serializers.UUIDField(source='group.id', read_only=True)

    class Meta:
        model = AssignedTest
        fields = ['id', 'title', 'due_at', 'timer_seconds', 'template_id', 'group_id', 'created_at']
        read_only_fields = ['id', 'group_id', 'created_at']


# --- 既存テスト互換: Question/Option/QuizSession API 用の最小シリアライザ ---
class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'text', 'is_correct']


class QuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'text', 'level', 'segment', 'options']


class QuizSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizSession
        fields = ['id', 'user', 'started_at', 'completed_at', 'total_time_ms']
        read_only_fields = ['id', 'started_at', 'completed_at', 'total_time_ms', 'user']
