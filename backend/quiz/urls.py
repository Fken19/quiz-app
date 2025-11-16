"""新スキーマ用URL定義"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"users", views.UserViewSet, basename="user")
router.register(r"user-profiles", views.UserProfileViewSet, basename="user-profile")
router.register(r"teachers", views.TeacherViewSet, basename="teacher")
router.register(r"teacher-profiles", views.TeacherProfileViewSet, basename="teacher-profile")
router.register(r"teacher-whitelists", views.TeacherWhitelistViewSet, basename="teacher-whitelist")
router.register(r"invitation-codes", views.InvitationCodeViewSet, basename="invitation-code")
router.register(r"student-teacher-links", views.StudentTeacherLinkViewSet, basename="student-teacher-link")
router.register(r"roster-folders", views.RosterFolderViewSet, basename="roster-folder")
router.register(r"roster-memberships", views.RosterMembershipViewSet, basename="roster-membership")
router.register(r"vocabularies", views.VocabularyViewSet, basename="vocabulary")
router.register(r"vocab-translations", views.VocabTranslationViewSet, basename="vocab-translation")
router.register(r"vocab-choices", views.VocabChoiceViewSet, basename="vocab-choice")
router.register(r"user-vocab-statuses", views.UserVocabStatusViewSet, basename="user-vocab-status")
router.register(r"learning-activity-logs", views.LearningActivityLogViewSet, basename="learning-activity-log")
router.register(r"learning-summary-daily", views.LearningSummaryDailyViewSet, basename="learning-summary-daily")
router.register(r"quiz-collections", views.QuizCollectionViewSet, basename="quiz-collection")
router.register(r"quizzes", views.QuizViewSet, basename="quiz")
router.register(r"quiz-questions", views.QuizQuestionViewSet, basename="quiz-question")
router.register(r"quiz-results", views.QuizResultViewSet, basename="quiz-result")
router.register(r"quiz-result-details", views.QuizResultDetailViewSet, basename="quiz-result-detail")
router.register(r"tests", views.TestViewSet, basename="test")
router.register(r"test-questions", views.TestQuestionViewSet, basename="test-question")
router.register(r"test-assignments", views.TestAssignmentViewSet, basename="test-assignment")
router.register(r"test-assignees", views.TestAssigneeViewSet, basename="test-assignee")
router.register(r"test-results", views.TestResultViewSet, basename="test-result")
router.register(r"test-result-details", views.TestResultDetailViewSet, basename="test-result-detail")

urlpatterns = [
    path("", include(router.urls)),
    path("debug/create-user/", views.debug_create_user, name="debug-create-user"),
]
