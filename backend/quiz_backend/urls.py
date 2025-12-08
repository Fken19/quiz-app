"""
URL configuration for quiz_backend project.
"""
from django.contrib import admin
from django.urls import path, include

from quiz.views import media_serve

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('quiz.urls')),
    path('accounts/', include('allauth.urls')),
    path('media/<path:path>', media_serve, name='media'),
]
