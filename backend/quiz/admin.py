from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    User, Group, GroupMembership, Question, Option, 
    AssignedTest, QuizSession, QuizResult, 
    DailyUserStats, DailyGroupStats
)


class CustomUserAdmin(BaseUserAdmin):
    """カスタムユーザー管理"""
    list_display = ('email', 'display_name', 'is_staff', 'is_active', 'created_at')
    list_filter = ('is_staff', 'is_active', 'created_at')
    search_fields = ('email', 'display_name')
    ordering = ('-created_at',)
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('追加情報', {'fields': ('display_name',)}),
    )


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner_admin', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('name', 'owner_admin__email')


@admin.register(GroupMembership)
class GroupMembershipAdmin(admin.ModelAdmin):
    list_display = ('user', 'group', 'role', 'created_at')
    list_filter = ('role', 'created_at')
    search_fields = ('user__email', 'group__name')


class OptionInline(admin.TabularInline):
    model = Option
    extra = 4


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('text', 'level', 'segment', 'created_at')
    list_filter = ('level', 'segment', 'created_at')
    search_fields = ('text',)
    inlines = [OptionInline]


@admin.register(AssignedTest)
class AssignedTestAdmin(admin.ModelAdmin):
    list_display = ('title', 'group', 'due_at', 'created_at')
    list_filter = ('due_at', 'created_at')
    search_fields = ('title', 'group__name')


@admin.register(QuizSession)
class QuizSessionAdmin(admin.ModelAdmin):
    list_display = ('user', 'started_at', 'completed_at', 'total_time_ms')
    list_filter = ('started_at', 'completed_at')
    search_fields = ('user__email',)


@admin.register(QuizResult)
class QuizResultAdmin(admin.ModelAdmin):
    list_display = ('session', 'question', 'is_correct', 'elapsed_ms', 'created_at')
    list_filter = ('is_correct', 'created_at')
    search_fields = ('session__user__email', 'question__text')


@admin.register(DailyUserStats)
class DailyUserStatsAdmin(admin.ModelAdmin):
    list_display = ('user', 'date', 'attempts', 'correct', 'total_time_ms')
    list_filter = ('date',)
    search_fields = ('user__email',)


@admin.register(DailyGroupStats)
class DailyGroupStatsAdmin(admin.ModelAdmin):
    list_display = ('group', 'date', 'attempts', 'correct')
    list_filter = ('date',)
    search_fields = ('group__name',)


admin.site.register(User, CustomUserAdmin)
