"""
新しいクイズスキーマ用のURL設定
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views_new import (
    LevelViewSet, SegmentViewSet, WordViewSet,
    QuizSessionViewSet, DashboardViewSet, StatsViewSet
)

# 新しいAPIのルーター
router_v2 = DefaultRouter()
router_v2.register(r'levels', LevelViewSet, basename='levels')
router_v2.register(r'segments', SegmentViewSet, basename='segments')
router_v2.register(r'words', WordViewSet, basename='words')
router_v2.register(r'quiz-sessions', QuizSessionViewSet, basename='quiz-sessions')
router_v2.register(r'dashboard', DashboardViewSet, basename='dashboard')
router_v2.register(r'user-stats', StatsViewSet, basename='user-stats')

# 新しいAPI用のURL patterns
urlpatterns_v2 = [
    path('v2/', include(router_v2.urls)),
]
