from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    User,
    Group,
    GroupMembership,
    Question,
    Option,
    AssignedTest,
    QuizSession,
    QuizResult,
    DailyUserStats,
    DailyGroupStats,
    # 追加登録
    Word,
    WordTranslation,
    QuizSet,
    QuizItem,
    QuizResponse,
    InviteCode,
    TeacherStudentLink,
    TeacherWhitelist,
    TeacherStudentAlias,
)


class CustomUserAdmin(BaseUserAdmin):
    """カスタムユーザー管理"""
    list_display = (
        'email', 'display_name', 'role', 'is_staff', 'is_active', 'created_at'
    )
    list_filter = ('is_staff', 'is_active', 'created_at')
    search_fields = ('email', 'display_name')
    ordering = ('-created_at',)
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('追加情報', {
            'fields': (
                'display_name', 'organization', 'bio', 'avatar', 'avatar_url',
                'role', 'level_preference', 'quiz_count', 'total_score',
            )
        }),
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


class WordTranslationInline(admin.TabularInline):
    model = WordTranslation
    extra = 4


@admin.register(Word)
class WordAdmin(admin.ModelAdmin):
    # Adjusted to match the current `Word` model fields (text maps to DB column `lemma`)
    list_display = ('text', 'pos', 'grade', 'frequency', 'created_at')
    list_filter = ('pos', 'grade', 'created_at')
    search_fields = ('text',)
    inlines = [WordTranslationInline]


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


# 追加: クイズ進行系モデル（参照用）
@admin.register(QuizSet)
class QuizSetAdmin(admin.ModelAdmin):
    list_display = ('user', 'grade', 'total_questions', 'created_at')
    list_filter = ('grade', 'created_at')
    search_fields = ('user__email',)


@admin.register(QuizItem)
class QuizItemAdmin(admin.ModelAdmin):
    list_display = ('quiz_set', 'question_number', 'word', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('word__text',)


@admin.register(QuizResponse)
class QuizResponseAdmin(admin.ModelAdmin):
    list_display = ('user', 'quiz_item', 'is_correct', 'reaction_time_ms', 'created_at')
    list_filter = ('is_correct', 'created_at')
    search_fields = ('user__email', 'quiz_item__word__text')


# 追加: 招待コード・講師-生徒リンク・ホワイトリスト
@admin.register(InviteCode)
class InviteCodeAdmin(admin.ModelAdmin):
    list_display = ('code', 'issued_by', 'status', 'issued_at', 'expires_at', 'used_by')
    list_filter = ('revoked', 'issued_at', 'expires_at')
    search_fields = ('code', 'issued_by__email', 'used_by__email')
    readonly_fields = ('issued_at', 'used_at', 'revoked_at')


@admin.register(TeacherStudentLink)
class TeacherStudentLinkAdmin(admin.ModelAdmin):
    list_display = ('teacher', 'student', 'status', 'linked_at', 'revoked_at')
    list_filter = ('status', 'linked_at')
    search_fields = ('teacher__email', 'student__email')
    readonly_fields = ('linked_at',)


@admin.register(TeacherWhitelist)
class TeacherWhitelistAdmin(admin.ModelAdmin):
    # 最小構成（メール中心）。DBに存在する列のみを使用
    list_display = ('email', 'note', 'created_at', 'created_by')
    list_filter = ('created_at',)
    search_fields = ('email', 'note')
    ordering = ('-created_at',)
    list_per_page = 25

    readonly_fields = ('created_at',)
    fieldsets = (
        (None, {'fields': ('email', 'note')}),
        ('メタ情報', {'classes': ('collapse',), 'fields': ('created_at', 'created_by')}),
    )


@admin.register(TeacherStudentAlias)
class TeacherStudentAliasAdmin(admin.ModelAdmin):
    list_display = ('teacher', 'student', 'alias_name', 'updated_at')
    list_filter = ('updated_at',)
    search_fields = ('teacher__email', 'student__email', 'alias_name')
