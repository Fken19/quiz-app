"""新スキーマ用シリアライザー"""

from rest_framework import serializers

from . import models
from .utils import is_teacher_whitelisted


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

    class Meta:
        model = models.StudentTeacherLink
        fields = [
            "student_teacher_link_id",
            "teacher",
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
        ]
        read_only_fields = ["linked_at", "updated_at"]


class RosterFolderSerializer(serializers.ModelSerializer):
    roster_folder_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.RosterFolder
        fields = [
            "roster_folder_id",
            "owner_teacher",
            "parent_folder",
            "name",
            "sort_order",
            "is_dynamic",
            "dynamic_filter",
            "notes",
            "archived_at",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class RosterMembershipSerializer(serializers.ModelSerializer):
    roster_membership_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = models.RosterMembership
        fields = [
            "roster_membership_id",
            "roster_folder",
            "student",
            "added_at",
            "removed_at",
            "note",
        ]
        read_only_fields = ["added_at"]


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

    class Meta:
        model = models.QuizResultDetail
        fields = [
            "quiz_result_detail_id",
            "quiz_result",
            "question_order",
            "vocabulary",
            "selected_text",
            "is_correct",
            "is_timeout",
            "reaction_time_ms",
            "created_at",
        ]
        read_only_fields = ["created_at"]


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
