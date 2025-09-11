from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'questions', views.QuestionViewSet)
router.register(r'sessions', views.QuizSessionViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('health/', views.HealthCheckView.as_view(), name='health-check'),
    path('auth/me/', views.CurrentUserView.as_view(), name='current-user'),
    path('me/results/', views.UserResultsView.as_view(), name='user-results'),
    path('me/dashboard/', views.UserDashboardView.as_view(), name='user-dashboard'),
    path('me/profile/', views.UserProfileView.as_view(), name='user-profile'),
    path('submit/', views.QuizSubmitView.as_view(), name='quiz-submit'),
    
    # レベル・セグメント機能
    path('levels/', views.QuizLevelsView.as_view(), name='quiz-levels'),
    path('levels/<int:level>/segments/', views.QuizSegmentsView.as_view(), name='quiz-segments'),
    path('levels/<int:level>/', views.QuizLevelQuestionsView.as_view(), name='quiz-level-questions'),
    path('levels/<int:level>/segments/<int:segment>/', views.QuizLevelQuestionsView.as_view(), name='quiz-segment-questions'),
    
    # 認証機能
    path('auth/status/', views.AuthStatusView.as_view(), name='auth-status'),
    path('auth/logout/', views.LogoutView.as_view(), name='auth-logout'),
    path('auth/google/', views.GoogleAuthView.as_view(), name='auth-google'),
    path('admin/', include([
        path('users/', views.AdminUserListView.as_view(), name='admin-users'),
        path('groups/', views.AdminGroupListView.as_view(), name='admin-groups'),
        path('stats/daily/', views.AdminDailyStatsView.as_view(), name='admin-daily-stats'),
    ])),
]
