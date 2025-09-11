from rest_framework import serializers
from .models import (
    User, Word, WordTranslation, QuizSet, QuizItem, QuizResponse, Group
)


class UserSerializer(serializers.ModelSerializer):
    average_score = serializers.ReadOnlyField()
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'display_name', 'avatar_url', 'role', 'created_at',
            'last_login', 'level_preference', 'quiz_count', 'total_score', 'average_score'
        ]
        read_only_fields = ['id', 'created_at', 'quiz_count', 'total_score', 'average_score']


class WordTranslationSerializer(serializers.ModelSerializer):
    class Meta:
        model = WordTranslation
        fields = ['id', 'text', 'is_correct']


class WordSerializer(serializers.ModelSerializer):
    translations = WordTranslationSerializer(many=True, read_only=True)
    
    class Meta:
        model = Word
        fields = ['id', 'text', 'level', 'segment', 'difficulty', 'translations']


class QuizItemSerializer(serializers.ModelSerializer):
    word = WordSerializer(read_only=True)
    
    class Meta:
        model = QuizItem
        fields = ['id', 'word', 'order']


class QuizResponseSerializer(serializers.ModelSerializer):
    quiz_item = QuizItemSerializer(read_only=True)
    selected_translation = WordTranslationSerializer(read_only=True)
    
    class Meta:
        model = QuizResponse
        fields = [
            'id', 'quiz_item', 'selected_translation', 'is_correct', 'reaction_time_ms', 'created_at'
        ]


class QuizSetSerializer(serializers.ModelSerializer):
    quiz_items = QuizItemSerializer(many=True, read_only=True)
    quiz_responses = QuizResponseSerializer(many=True, read_only=True)
    total_duration_ms = serializers.ReadOnlyField()
    
    class Meta:
        model = QuizSet
        fields = [
            'id', 'mode', 'level', 'segment', 'question_count', 'started_at', 
            'finished_at', 'score', 'created_at', 'quiz_items', 'quiz_responses',
            'total_duration_ms'
        ]
        read_only_fields = ['id', 'created_at', 'total_duration_ms']


class QuizSetCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizSet
        fields = ['mode', 'level', 'segment', 'question_count']


class QuizResponseCreateSerializer(serializers.Serializer):
    quiz_item_id = serializers.UUIDField()
    selected_translation_id = serializers.UUIDField()
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
    
    class Meta:
        model = QuizSet
        fields = ['id', 'title', 'difficulty', 'created_at', 'times_attempted', 'item_count', 'completion_rate']
    
    def get_item_count(self, obj):
        return obj.items.count()
    
    def get_completion_rate(self, obj):
        # ユーザーの回答率を計算
        user = self.context.get('request').user if self.context.get('request') else None
        if user:
            total_items = obj.items.count()
            answered_items = QuizResponse.objects.filter(
                user=user,
                quiz_item__quiz_set=obj
            ).count()
            return (answered_items / total_items * 100) if total_items > 0 else 0
        return 0


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
