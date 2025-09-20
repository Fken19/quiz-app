
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token
from django.http import JsonResponse
from . import views
from .urls_new import urlpatterns_v2
from .views_new import WordViewSet as V2WordViewSet

# APIルーター
router = DefaultRouter()
# v1互換の words は v2 実装を使用（公開形状は v2 準拠）。
router.register(r'words', V2WordViewSet, basename='words')
# 旧 quiz-sets は未使用/非推奨のため、一旦ルーティングから外す（必要なら後で互換層を追加）
# router.register(r'quiz-sets', views.QuizSetViewSet, basename='quiz-set')
# 既存テスト互換エンドポイント
router.register(r'questions', views.QuestionViewSet, basename='question')
# 旧 quizsessions は未使用のため登録しない（v2へ移行済み）
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

    # 個別API エンドポイント（最低限のみ有効化）
    path('auth/check-teacher/', views.check_teacher_permission, name='check_teacher_permission'),
    path('debug/auth/', views.debug_auth, name='debug_auth'),  # デバッグ用
    path('debug/create-user/', views.create_test_user, name='create_test_user'),  # デバッグ用
    path('debug/make-user-teacher/', views.make_user_teacher, name='make_user_teacher'),  # デバッグ用: roleをteacherに変更
    path('debug/link-teacher-student/', views.debug_link_teacher_student, name='debug_link_teacher_student'),  # デバッグ用: teacher/student を直接リンク
    path('dashboard/stats/', views.dashboard_stats, name='dashboard_stats'),
    path('dashboard/learning-metrics/', views.learning_metrics, name='learning_metrics'),
    path('user/profile/', views.user_profile, name='user_profile'),
    path('quiz/history/', views.quiz_history, name='quiz_history'),
    path('quiz/result/<str:quiz_set_id>/', views.quiz_result, name='quiz_result'),
]
