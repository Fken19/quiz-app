from rest_framework import serializers
from .models import (
    User, Question, Option, QuizSession, QuizResult,
    Group, GroupMembership, DailyUserStats, DailyGroupStats
)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'display_name', 'is_staff', 'created_at']
        read_only_fields = ['id', 'created_at']


class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'text', 'is_correct']


class QuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, read_only=True)
    
    class Meta:
        model = Question
        fields = ['id', 'text', 'level', 'segment', 'options']


class QuizResultSerializer(serializers.ModelSerializer):
    question = QuestionSerializer(read_only=True)
    chosen_option = OptionSerializer(read_only=True)
    
    class Meta:
        model = QuizResult
        fields = ['id', 'question', 'chosen_option', 'is_correct', 'elapsed_ms', 'created_at']


class QuizSessionSerializer(serializers.ModelSerializer):
    results = QuizResultSerializer(many=True, read_only=True)
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = QuizSession
        fields = ['id', 'user', 'started_at', 'completed_at', 'total_time_ms', 'results']
        read_only_fields = ['id', 'user', 'started_at']


class QuizSessionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizSession
        fields = ['id']
        read_only_fields = ['id']


class AnswerSubmissionSerializer(serializers.Serializer):
    question_id = serializers.UUIDField()
    chosen_option_id = serializers.UUIDField(required=False, allow_null=True)
    elapsed_ms = serializers.IntegerField(required=False, allow_null=True)


class GroupSerializer(serializers.ModelSerializer):
    owner_admin = UserSerializer(read_only=True)
    
    class Meta:
        model = Group
        fields = ['id', 'name', 'owner_admin', 'created_at']


class GroupMembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    group = GroupSerializer(read_only=True)
    
    class Meta:
        model = GroupMembership
        fields = ['id', 'user', 'group', 'role', 'created_at']


class DailyUserStatsSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = DailyUserStats
        fields = ['date', 'user', 'attempts', 'correct', 'total_time_ms']


class DailyGroupStatsSerializer(serializers.ModelSerializer):
    group = GroupSerializer(read_only=True)
    
    class Meta:
        model = DailyGroupStats
        fields = ['date', 'group', 'attempts', 'correct']
