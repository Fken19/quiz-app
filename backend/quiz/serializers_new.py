"""
新しいクイズスキーマ用のシリアライザー
"""
from rest_framework import serializers
from .models_new import (
    Level, Segment, NewWord, SegmentWord, 
    NewWordTranslation, NewWordChoice, 
    NewQuizSession, NewQuizResult,
    NewDailyUserStats, NewDailyGroupStats
)
from .models import User


class LevelSerializer(serializers.ModelSerializer):
    """レベルシリアライザー"""
    
    class Meta:
        model = Level
        fields = ['level_id', 'level_name', 'created_at', 'updated_at']
        read_only_fields = ['level_id', 'created_at', 'updated_at']


class NewWordChoiceSerializer(serializers.ModelSerializer):
    """選択肢シリアライザー"""
    
    class Meta:
        model = NewWordChoice
        fields = ['text_ja', 'is_correct']


class NewWordTranslationSerializer(serializers.ModelSerializer):
    """正答集合シリアライザー"""
    
    class Meta:
        model = NewWordTranslation
        fields = ['text_ja', 'is_correct']


class WordDetailSerializer(serializers.ModelSerializer):
    """単語詳細シリアライザー"""
    translations = NewWordTranslationSerializer(many=True, read_only=True)
    choices = NewWordChoiceSerializer(many=True, read_only=True)
    
    class Meta:
        model = NewWord
        fields = [
            'word_id', 'text_en', 'part_of_speech', 'explanation',
            'example_en', 'example_ja', 'translations', 'choices',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['word_id', 'created_at', 'updated_at']


class WordSerializer(serializers.ModelSerializer):
    """単語シリアライザー"""
    
    class Meta:
        model = NewWord
        fields = ['word_id', 'text_en', 'part_of_speech', 'explanation', 'example_en', 'example_ja']


class SegmentWordSerializer(serializers.ModelSerializer):
    """セグメント単語シリアライザー"""
    word = WordSerializer(source='word_id', read_only=True)
    
    class Meta:
        model = SegmentWord
        fields = ['question_order', 'word']


class SegmentListSerializer(serializers.ModelSerializer):
    """セグメント一覧シリアライザー"""
    level = LevelSerializer(source='level_id', read_only=True)
    word_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Segment
        fields = [
            'segment_id', 'segment_name', 'publish_status',
            'level', 'word_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['segment_id', 'created_at', 'updated_at']
    
    def get_word_count(self, obj):
        return obj.segment_words.count()


class QuizQuestionSerializer(serializers.Serializer):
    """クイズ問題シリアライザー"""
    order = serializers.IntegerField()
    word = WordSerializer()
    choices = NewWordChoiceSerializer(many=True)


class SegmentQuizSerializer(serializers.ModelSerializer):
    """セグメントクイズシリアライザー（出題用）"""
    level = LevelSerializer(source='level_id', read_only=True)
    questions = serializers.SerializerMethodField()
    
    class Meta:
        model = Segment
        fields = [
            'segment_id', 'segment_name', 'level', 'questions'
        ]
    
    def get_questions(self, obj):
        """セグメントの10問を順序付きで取得し、各問に選択肢を付加"""
        questions = []
        segment_words = obj.segment_words.select_related('word_id').order_by('question_order')
        
        for sw in segment_words:
            word = sw.word_id
            # 正解選択肢1個 + ダミー選択肢3個をランダムで構成
            correct_qs = word.choices.filter(is_correct=True)
            # 正解が複数ある場合はランダムに1つ選ぶ
            # サーバ側は決定的な順序で返す（クライアントでシャッフルするため）
            correct_choice = list(correct_qs.order_by('word_choice_id')[:1])
            dummy_choices = list(word.choices.filter(is_correct=False).order_by('word_choice_id')[:3])
            all_choices = correct_choice + dummy_choices
            
            question = {
                'order': sw.question_order,
                'word': WordSerializer(word).data,
                'choices': NewWordChoiceSerializer(all_choices, many=True).data
            }
            questions.append(question)
        
        return questions


class QuizSessionCreateSerializer(serializers.ModelSerializer):
    """クイズセッション作成シリアライザー"""
    
    class Meta:
        model = NewQuizSession
        fields = ['segment']
        
    def create(self, validated_data):
        user = self.context['request'].user
        return NewQuizSession.objects.create(user=user, **validated_data)


class QuizResultCreateSerializer(serializers.ModelSerializer):
    """クイズ結果作成シリアライザー"""
    
    class Meta:
        model = NewQuizResult
        fields = [
            'word', 'question_order', 'selected_choice', 
            'selected_text', 'is_correct', 'reaction_time_ms'
        ]


class QuizResultSerializer(serializers.ModelSerializer):
    """クイズ結果シリアライザー"""
    word = WordSerializer(read_only=True)
    selected_choice = NewWordChoiceSerializer(read_only=True)
    
    class Meta:
        model = NewQuizResult
        fields = [
            'id', 'word', 'question_order', 'selected_choice', 
            'selected_text', 'is_correct', 'reaction_time_ms',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class QuizSessionSerializer(serializers.ModelSerializer):
    """クイズセッションシリアライザー"""
    segment = SegmentListSerializer(read_only=True)
    results = QuizResultSerializer(many=True, read_only=True)
    score_percentage = serializers.ReadOnlyField()
    is_completed = serializers.ReadOnlyField()
    
    class Meta:
        model = NewQuizSession
        fields = [
            'id', 'segment', 'started_at', 'completed_at',
            'total_time_ms', 'score', 'score_percentage',
            'is_completed', 'results'
        ]
        read_only_fields = ['id', 'started_at']


class QuizSessionListSerializer(serializers.ModelSerializer):
    """クイズセッション一覧シリアライザー"""
    segment = SegmentListSerializer(read_only=True)
    score_percentage = serializers.ReadOnlyField()
    is_completed = serializers.ReadOnlyField()
    
    class Meta:
        model = NewQuizSession
        fields = [
            'id', 'segment', 'started_at', 'completed_at',
            'score', 'score_percentage', 'is_completed'
        ]
        read_only_fields = ['id', 'started_at']


class DailyUserStatsSerializer(serializers.ModelSerializer):
    """日次ユーザー統計シリアライザー"""
    accuracy_percentage = serializers.SerializerMethodField()
    avg_time_per_question_ms = serializers.SerializerMethodField()
    
    class Meta:
        model = NewDailyUserStats
        fields = [
            'date', 'sessions_count', 'questions_attempted',
            'questions_correct', 'accuracy_percentage',
            'total_time_ms', 'avg_time_per_question_ms',
            'created_at'
        ]
        read_only_fields = ['created_at']
    
    def get_accuracy_percentage(self, obj):
        if obj.questions_attempted == 0:
            return 0
        return (obj.questions_correct / obj.questions_attempted) * 100
    
    def get_avg_time_per_question_ms(self, obj):
        if obj.questions_attempted == 0:
            return 0
        return obj.total_time_ms / obj.questions_attempted


class DailyGroupStatsSerializer(serializers.ModelSerializer):
    """日次グループ統計シリアライザー"""
    accuracy_percentage = serializers.SerializerMethodField()
    
    class Meta:
        model = NewDailyGroupStats
        fields = [
            'date', 'sessions_count', 'questions_attempted',
            'questions_correct', 'accuracy_percentage',
            'created_at'
        ]
        read_only_fields = ['created_at']
    
    def get_accuracy_percentage(self, obj):
        if obj.questions_attempted == 0:
            return 0
        return (obj.questions_correct / obj.questions_attempted) * 100
