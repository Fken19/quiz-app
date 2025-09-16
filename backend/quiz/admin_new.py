from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    User, Word, WordTranslation, WordDistractor, WordForm, 
    ExampleSentence, TextbookScope, QuizSet, QuizItem, QuizResponse,
    TeacherWhitelist, InviteCode, TeacherStudentLink
)


class CustomUserAdmin(BaseUserAdmin):
    """カスタムユーザー管理"""
    list_display = (
        'email', 'display_name', 'role', 'is_staff', 'is_active', 'created_at'
    )
    list_filter = ('role', 'is_staff', 'is_active', 'created_at')
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


# 新しい単語関連のインライン
class WordTranslationInline(admin.TabularInline):
    model = WordTranslation
    extra = 1
    fields = ('text', 'language', 'is_primary')


class WordDistractorInline(admin.TabularInline):
    model = WordDistractor
    extra = 0
    fields = ('slot', 'translation')
    
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "translation":
            # 他の単語の訳語のみを表示（主訳以外）
            kwargs["queryset"] = WordTranslation.objects.filter(is_primary=False)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


class WordFormInline(admin.TabularInline):
    model = WordForm
    extra = 0
    fields = ('feature', 'form')


class ExampleSentenceInline(admin.TabularInline):
    model = ExampleSentence
    extra = 0
    fields = ('en', 'ja', 'source', 'is_simple')


class TextbookScopeInline(admin.TabularInline):
    model = TextbookScope
    extra = 0
    fields = ('series', 'edition', 'unit', 'range_note')


@admin.register(Word)
class WordAdmin(admin.ModelAdmin):
    list_display = ('text', 'pos', 'level', 'segment', 'grade', 'is_active', 'created_at')
    list_filter = ('pos', 'level', 'segment', 'grade', 'is_active', 'created_at')
    search_fields = ('text', 'lemma', 'explanation')
    ordering = ('level', 'segment', 'text')
    
    fieldsets = (
        ('基本情報', {
            'fields': ('text', 'lemma', 'pos', 'level', 'segment', 'grade')
        }),
        ('詳細', {
            'fields': ('explanation', 'is_active')
        }),
    )
    
    inlines = [
        WordTranslationInline,
        WordDistractorInline,
        WordFormInline,
        ExampleSentenceInline,
        TextbookScopeInline,
    ]


@admin.register(WordTranslation)
class WordTranslationAdmin(admin.ModelAdmin):
    list_display = ('text', 'word', 'language', 'is_primary', 'created_at')
    list_filter = ('language', 'is_primary', 'created_at')
    search_fields = ('text', 'word__text')
    ordering = ('word__text', 'is_primary')


@admin.register(WordDistractor)
class WordDistractorAdmin(admin.ModelAdmin):
    list_display = ('word', 'slot', 'translation', 'translation_word')
    list_filter = ('slot',)
    search_fields = ('word__text', 'translation__text')
    ordering = ('word__text', 'slot')
    
    def translation_word(self, obj):
        return obj.translation.word.text
    translation_word.short_description = '偽訳元単語'


@admin.register(WordForm)
class WordFormAdmin(admin.ModelAdmin):
    list_display = ('word', 'feature', 'form')
    list_filter = ('feature',)
    search_fields = ('word__text', 'form')
    ordering = ('word__text', 'feature')


@admin.register(ExampleSentence)
class ExampleSentenceAdmin(admin.ModelAdmin):
    list_display = ('word', 'en_excerpt', 'source', 'is_simple')
    list_filter = ('is_simple', 'source')
    search_fields = ('word__text', 'en', 'ja')
    ordering = ('word__text',)
    
    def en_excerpt(self, obj):
        return obj.en[:100] + '...' if len(obj.en) > 100 else obj.en
    en_excerpt.short_description = '英文（抜粋）'


@admin.register(TextbookScope)
class TextbookScopeAdmin(admin.ModelAdmin):
    list_display = ('word', 'series', 'edition', 'unit', 'range_note')
    list_filter = ('series', 'edition')
    search_fields = ('word__text', 'series', 'unit')
    ordering = ('word__text', 'series')


# クイズ関連
@admin.register(QuizSet)
class QuizSetAdmin(admin.ModelAdmin):
    list_display = ('user', 'mode', 'level', 'segment', 'question_count', 'score', 'created_at')
    list_filter = ('mode', 'level', 'segment', 'created_at')
    search_fields = ('user__email', 'user__display_name')
    ordering = ('-created_at',)


@admin.register(QuizItem)
class QuizItemAdmin(admin.ModelAdmin):
    list_display = ('quiz_set', 'order', 'word', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('quiz_set__user__email', 'word__text')
    ordering = ('quiz_set', 'order')


@admin.register(QuizResponse)
class QuizResponseAdmin(admin.ModelAdmin):
    list_display = ('quiz_set', 'quiz_item_word', 'selected_translation', 'is_correct', 'latency_ms', 'answered_at')
    list_filter = ('is_correct', 'answered_at')
    search_fields = ('quiz_set__user__email', 'quiz_item__word__text')
    ordering = ('-answered_at',)
    
    def quiz_item_word(self, obj):
        return obj.quiz_item.word.text
    quiz_item_word.short_description = '単語'


# 管理機能関連
@admin.register(TeacherWhitelist)
class TeacherWhitelistAdmin(admin.ModelAdmin):
    list_display = ('email', 'note', 'created_by', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('email', 'note', 'created_by__email')
    readonly_fields = ('created_at',)


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


admin.site.register(User, CustomUserAdmin)

# サイトの表示名をカスタマイズ
admin.site.site_header = 'Quiz App 管理画面'
admin.site.site_title = 'Quiz App Admin'
admin.site.index_title = 'クイズアプリ管理'
