
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token
from django.http import JsonResponse
from . import views
from .urls_new import urlpatterns_v2

# APIルーター
router = DefaultRouter()
router.register(r'words', views.WordViewSet)
router.register(r'quiz-sets', views.QuizSetViewSet, basename='quiz-set')
router.register(r'questions', views.QuestionViewSet, basename='question')
router.register(r'quizsessions', views.QuizSessionViewSet, basename='quizsession')
# 講師・生徒管理API
router.register(r'teacher/invite-codes', views.TeacherInviteCodeViewSet, basename='teacher-invite-code')
router.register(r'teacher/students', views.TeacherStudentViewSet, basename='teacher-student')
router.register(r'teacher/groups', views.TeacherGroupViewSet, basename='teacher-group')
router.register(r'teacher/aliases', views.TeacherAliasViewSet, basename='teacher-alias')
router.register(r'teacher/student-detail', views.TeacherStudentDetailViewSet, basename='teacher-student-detail')
router.register(r'teacher/test-templates', views.TeacherTestTemplateViewSet, basename='teacher-test-template')
router.register(r'student/invite', views.StudentInviteCodeView, basename='student-invite')
router.register(r'student/teachers', views.StudentTeacherViewSet, basename='student-teacher')

def test_view(request):
    return JsonResponse({'message': 'New URL pattern is working!'})

urlpatterns = [
    # Test URL
    path('test/', test_view, name='test'),

    # Token認証エンドポイント
    path('auth/token/', obtain_auth_token, name='api_token_auth'),

    # 新しいAPI (v2)
    *urlpatterns_v2,

    # Router URLs (v1 - 既存API)
    path('', include(router.urls)),

    # 個別API エンドポイント
    path('auth/google/', views.google_auth, name='google_auth'),
    path('auth/google-simple/', views.google_auth_simple, name='google_auth_simple'),  # テスト用
    path('auth/check-teacher/', views.check_teacher_permission, name='check_teacher_permission'),
    path('debug/auth/', views.debug_auth, name='debug_auth'),  # デバッグ用
    path('debug/create-user/', views.create_test_user, name='create_test_user'),  # デバッグ用
    path('dashboard/stats/', views.dashboard_stats, name='dashboard_stats'),
    path('dashboard/learning-metrics/', views.learning_metrics, name='learning_metrics'),
    # フォーカス学習API
    path('focus/status-counts/', views.focus_status_counts, name='focus_status_counts'),
    path('focus/start/', views.focus_start, name='focus_start'),
    path('quiz/history/', views.quiz_history, name='quiz_history'),
    path('quiz/result/<str:quiz_set_id>/', views.quiz_result, name='quiz_result'),
    path('user/profile/', views.user_profile, name='user_profile'),
    path('quiz/generate/', views.generate_quiz_set, name='generate_quiz_set'),
    # 既存テスト互換（個別）
    path('current-user/', views.current_user, name='current-user'),
    path('admin/users/', views.admin_users, name='admin-users'),
]
