"""Django admin 登録"""

from django.contrib import admin

from . import models


@admin.register(models.User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "oauth_provider", "disabled_at", "deleted_at", "created_at")
    search_fields = ("email", "oauth_sub")
    list_filter = ("oauth_provider", "disabled_at")


@admin.register(models.UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "display_name", "grade", "updated_at")
    search_fields = ("user__email", "display_name")


@admin.register(models.Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ("email", "oauth_provider", "disabled_at", "created_at")
    search_fields = ("email", "oauth_sub")
    list_filter = ("oauth_provider", "disabled_at")


@admin.register(models.TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = ("teacher", "display_name", "affiliation", "updated_at")
    search_fields = ("teacher__email", "display_name", "affiliation")


@admin.register(models.TeacherWhitelist)
class TeacherWhitelistAdmin(admin.ModelAdmin):
    list_display = ("email", "can_publish_vocab", "revoked_at", "created_at")
    search_fields = ("email",)
    list_filter = ("can_publish_vocab", "revoked_at")


@admin.register(models.InvitationCode)
class InvitationCodeAdmin(admin.ModelAdmin):
    list_display = ("invitation_code", "issued_by", "issued_at", "expires_at", "used_by", "revoked")
    search_fields = ("invitation_code", "issued_by__email", "used_by__email")
    list_filter = ("revoked",)


@admin.register(models.StudentTeacherLink)
class StudentTeacherLinkAdmin(admin.ModelAdmin):
    list_display = ("teacher", "student", "status", "linked_at", "updated_at")
    search_fields = ("teacher__email", "student__email", "custom_display_name")
    list_filter = ("status",)


@admin.register(models.RosterFolder)
class RosterFolderAdmin(admin.ModelAdmin):
    list_display = ("name", "owner_teacher", "parent_folder", "is_dynamic", "archived_at", "created_at")
    search_fields = ("name", "owner_teacher__email")
    list_filter = ("is_dynamic", "archived_at")


@admin.register(models.RosterMembership)
class RosterMembershipAdmin(admin.ModelAdmin):
    list_display = ("roster_folder", "student", "added_at", "removed_at")
    search_fields = ("roster_folder__name", "student__email")
    list_filter = ("removed_at",)


@admin.register(models.Vocabulary)
class VocabularyAdmin(admin.ModelAdmin):
    list_display = ("text_en", "visibility", "status", "sense_count", "created_at")
    search_fields = ("text_en", "text_key")
    list_filter = ("visibility", "status")


@admin.register(models.VocabTranslation)
class VocabTranslationAdmin(admin.ModelAdmin):
    list_display = ("vocabulary", "text_ja", "is_primary", "created_at")
    search_fields = ("text_ja", "vocabulary__text_en")
    list_filter = ("is_primary",)


@admin.register(models.VocabChoice)
class VocabChoiceAdmin(admin.ModelAdmin):
    list_display = ("vocabulary", "text_ja", "is_correct", "weight", "created_at")
    search_fields = ("text_ja", "vocabulary__text_en")
    list_filter = ("is_correct",)


@admin.register(models.QuizCollection)
class QuizCollectionAdmin(admin.ModelAdmin):
    list_display = ("title", "scope", "owner_user", "is_published", "archived_at", "created_at")
    search_fields = ("title", "owner_user__email")
    list_filter = ("scope", "is_published", "archived_at")


@admin.register(models.Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ("quiz_collection", "sequence_no", "timer_seconds", "archived_at", "created_at")
    search_fields = ("quiz_collection__title",)
    list_filter = ("archived_at",)


@admin.register(models.QuizQuestion)
class QuizQuestionAdmin(admin.ModelAdmin):
    list_display = ("quiz", "question_order", "vocabulary", "archived_at", "created_at")
    search_fields = ("quiz__quiz_collection__title", "vocabulary__text_en")
    list_filter = ("archived_at",)


@admin.register(models.QuizResult)
class QuizResultAdmin(admin.ModelAdmin):
    list_display = ("user", "quiz", "started_at", "completed_at", "score")
    search_fields = ("user__email", "quiz__quiz_collection__title")
    list_filter = ("started_at",)


@admin.register(models.QuizResultDetail)
class QuizResultDetailAdmin(admin.ModelAdmin):
    list_display = ("quiz_result", "question_order", "vocabulary", "is_correct", "created_at")
    search_fields = ("quiz_result__user__email", "vocabulary__text_en")
    list_filter = ("is_correct",)


@admin.register(models.Test)
class TestAdmin(admin.ModelAdmin):
    list_display = ("title", "teacher", "due_at", "max_attempts_per_student", "archived_at", "created_at")
    search_fields = ("title", "teacher__email")
    list_filter = ("archived_at",)


@admin.register(models.TestQuestion)
class TestQuestionAdmin(admin.ModelAdmin):
    list_display = ("test", "question_order", "vocabulary", "weight", "timer_seconds")
    search_fields = ("test__title", "vocabulary__text_en")


@admin.register(models.TestAssignment)
class TestAssignmentAdmin(admin.ModelAdmin):
    list_display = ("test", "assigned_by_teacher", "assigned_at")
    search_fields = ("test__title", "assigned_by_teacher__email")
    list_filter = ("assigned_at",)


@admin.register(models.TestAssignee)
class TestAssigneeAdmin(admin.ModelAdmin):
    list_display = ("test", "student", "assigned_at", "source_type", "max_attempts")
    search_fields = ("test__title", "student__email")
    list_filter = ("source_type",)


@admin.register(models.TestResult)
class TestResultAdmin(admin.ModelAdmin):
    list_display = ("test", "student", "attempt_no", "started_at", "completed_at", "score")
    search_fields = ("test__title", "student__email")
    list_filter = ("attempt_no",)


@admin.register(models.TestResultDetail)
class TestResultDetailAdmin(admin.ModelAdmin):
    list_display = ("test_result", "question_order", "vocabulary", "is_correct", "created_at")
    search_fields = ("test_result__student__email", "vocabulary__text_en")
    list_filter = ("is_correct",)
