"""
新しいクイズスキーマ用の管理画面設定
"""
from django.contrib import admin
from .models_new import (
    Level, Segment, NewWord, SegmentWord, NewWordTranslation, NewWordChoice,
    NewQuizSession, NewQuizResult, NewDailyUserStats, NewDailyGroupStats
)


@admin.register(Level)
class LevelAdmin(admin.ModelAdmin):
    list_display = ['level_id', 'level_name', 'created_at', 'updated_at']
    list_filter = ['created_at', 'updated_at']
    search_fields = ['level_name']
    readonly_fields = ['level_id', 'created_at', 'updated_at']


class SegmentWordInline(admin.TabularInline):
    model = SegmentWord
    extra = 0
    fields = ['word_id', 'question_order']
    autocomplete_fields = ['word_id']


@admin.register(Segment)
class SegmentAdmin(admin.ModelAdmin):
    list_display = ['segment_id', 'segment_name', 'level_id', 'publish_status', 'word_count', 'created_at']
    list_filter = ['publish_status', 'level_id', 'created_at', 'updated_at']
    search_fields = ['segment_name', 'level_id__level_name']
    readonly_fields = ['segment_id', 'created_at', 'updated_at']
    autocomplete_fields = ['level_id']
    inlines = [SegmentWordInline]
    
    def word_count(self, obj):
        return obj.segment_words.count()
    word_count.short_description = '単語数'


class WordTranslationInline(admin.TabularInline):
    model = NewWordTranslation
    extra = 1
    fields = ['text_ja', 'is_correct']


class WordChoiceInline(admin.TabularInline):
    model = NewWordChoice
    extra = 4
    fields = ['text_ja', 'is_correct']


@admin.register(NewWord)
class WordAdmin(admin.ModelAdmin):
    list_display = ['word_id', 'text_en', 'part_of_speech', 'translation_preview', 'choice_count', 'created_at']
    list_filter = ['part_of_speech', 'created_at', 'updated_at']
    search_fields = ['text_en', 'translations__text_ja']
    readonly_fields = ['word_id', 'created_at', 'updated_at']
    inlines = [WordTranslationInline, WordChoiceInline]
    
    def translation_preview(self, obj):
        translations = obj.translations.filter(is_correct=True)[:2]
        return ', '.join([t.text_ja for t in translations])
    translation_preview.short_description = '正答集合'
    
    def choice_count(self, obj):
        correct = obj.choices.filter(is_correct=True).count()
        dummy = obj.choices.filter(is_correct=False).count()
        return f'正解:{correct} ダミー:{dummy}'
    choice_count.short_description = '選択肢数'


@admin.register(SegmentWord)
class SegmentWordAdmin(admin.ModelAdmin):
    list_display = ['segment_id', 'word_id', 'question_order']
    list_filter = ['segment_id__level_id', 'segment_id']
    search_fields = ['segment_id__segment_name', 'word_id__text_en']
    autocomplete_fields = ['segment_id', 'word_id']
    ordering = ['segment_id', 'question_order']


@admin.register(NewWordTranslation)
class WordTranslationAdmin(admin.ModelAdmin):
    list_display = ['word_id', 'text_ja', 'is_correct', 'created_at']
    list_filter = ['is_correct', 'created_at']
    search_fields = ['word_id__text_en', 'text_ja']
    autocomplete_fields = ['word_id']


@admin.register(NewWordChoice)
class WordChoiceAdmin(admin.ModelAdmin):
    list_display = ['word_id', 'text_ja', 'is_correct', 'created_at']
    list_filter = ['is_correct', 'created_at']
    search_fields = ['word_id__text_en', 'text_ja']
    autocomplete_fields = ['word_id']


class QuizResultInline(admin.TabularInline):
    model = NewQuizResult
    extra = 0
    fields = ['question_order', 'word', 'selected_text', 'is_correct', 'reaction_time_ms']
    readonly_fields = ['word', 'selected_text', 'is_correct', 'reaction_time_ms']
    ordering = ['question_order']


@admin.register(NewQuizSession)
class QuizSessionAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'segment', 'score', 'score_percentage', 'is_completed', 'started_at']
    list_filter = ['segment__level_id', 'segment', 'is_completed', 'started_at']
    search_fields = ['user__email', 'segment__segment_name']
    readonly_fields = ['id', 'score_percentage', 'is_completed', 'started_at']
    autocomplete_fields = ['user', 'segment']
    inlines = [QuizResultInline]
    
    def is_completed(self, obj):
        return obj.is_completed
    is_completed.boolean = True
    is_completed.short_description = '完了'


@admin.register(NewQuizResult)
class QuizResultAdmin(admin.ModelAdmin):
    list_display = ['session', 'word', 'question_order', 'selected_text', 'is_correct', 'reaction_time_ms', 'created_at']
    list_filter = ['is_correct', 'created_at', 'session__segment']
    search_fields = ['session__user__email', 'word__text_en', 'selected_text']
    readonly_fields = ['id', 'created_at']
    autocomplete_fields = ['session', 'word', 'selected_choice']


@admin.register(NewDailyUserStats)
class DailyUserStatsAdmin(admin.ModelAdmin):
    list_display = ['date', 'user', 'sessions_count', 'questions_attempted', 'questions_correct', 'accuracy_percentage', 'created_at']
    list_filter = ['date', 'created_at']
    search_fields = ['user__email']
    readonly_fields = ['accuracy_percentage', 'created_at']
    date_hierarchy = 'date'
    
    def accuracy_percentage(self, obj):
        if obj.questions_attempted == 0:
            return 0
        return f"{(obj.questions_correct / obj.questions_attempted) * 100:.1f}%"
    accuracy_percentage.short_description = '正答率'


@admin.register(NewDailyGroupStats)  
class DailyGroupStatsAdmin(admin.ModelAdmin):
    list_display = ['date', 'group', 'sessions_count', 'questions_attempted', 'questions_correct', 'accuracy_percentage', 'created_at']
    list_filter = ['date', 'created_at']
    search_fields = ['group__name']
    readonly_fields = ['accuracy_percentage', 'created_at']
    date_hierarchy = 'date'
    
    def accuracy_percentage(self, obj):
        if obj.questions_attempted == 0:
            return 0
        return f"{(obj.questions_correct / obj.questions_attempted) * 100:.1f}%"
    accuracy_percentage.short_description = '正答率'
