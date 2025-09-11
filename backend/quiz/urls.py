
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token
from django.http import JsonResponse
from . import views

# APIルーター
router = DefaultRouter()
router.register(r'words', views.WordViewSet)
router.register(r'quiz-sets', views.QuizSetViewSet, basename='quiz-set')

def test_view(request):
    return JsonResponse({'message': 'New URL pattern is working!'})

urlpatterns = [
    # Test URL
    path('test/', test_view, name='test'),

    # Token認証エンドポイント
    path('auth/token/', obtain_auth_token, name='api_token_auth'),

    # Router URLs
    path('', include(router.urls)),

    # 個別API エンドポイント
    path('auth/google/', views.google_auth, name='google_auth'),
    path('dashboard/stats/', views.dashboard_stats, name='dashboard_stats'),
    path('quiz/history/', views.quiz_history, name='quiz_history'),
    path('user/profile/', views.user_profile, name='user_profile'),
    path('quiz/generate/', views.generate_quiz_set, name='generate_quiz_set'),
]
