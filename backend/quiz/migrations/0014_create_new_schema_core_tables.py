"""
新しいクイズスキーマ用のマイグレーション - Phase 1: Core Tables
"""
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0013_fix_missing_group_tables'),  # 最新のマイグレーションファイルに依存
    ]

    operations = [
        # pgcrypto拡張を有効化（PostgreSQL用）
        migrations.RunSQL(
            "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
            reverse_sql="-- Cannot safely reverse pgcrypto extension creation"
        ),
        
    # Levels テーブル
        migrations.CreateModel(
            name='Level',
            fields=[
                ('level_id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('level_name', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
        'db_table': 'levels',
            },
        ),
        
    # Segments テーブル
        migrations.CreateModel(
            name='Segment',
            fields=[
                ('segment_id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('segment_name', models.TextField()),
                ('publish_status', models.TextField(choices=[('draft', 'Draft'), ('published', 'Published'), ('archived', 'Archived')], default='draft')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('level_id', models.ForeignKey(db_column='level_id', on_delete=django.db.models.deletion.CASCADE, related_name='segments', to='quiz.level')),
            ],
            options={
        'db_table': 'segments',
            },
        ),
        
    # Words テーブル
        migrations.CreateModel(
            name='NewWord',  # 既存のWordと区別するため一時的にNewWordとする
            fields=[
                ('word_id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('text_en', models.TextField(unique=True)),
                ('part_of_speech', models.TextField(blank=True, null=True)),
                ('explanation', models.TextField(blank=True, null=True)),
                ('example_en', models.TextField(blank=True, null=True)),
                ('example_ja', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
        'db_table': 'words',
            },
        ),
        
    # Segment Words テーブル
        migrations.CreateModel(
            name='SegmentWord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('question_order', models.IntegerField()),
        ('segment_id', models.ForeignKey(db_column='segment_id', on_delete=django.db.models.deletion.CASCADE, related_name='segment_words', to='quiz.segment')),
        ('word_id', models.ForeignKey(db_column='word_id', on_delete=django.db.models.deletion.RESTRICT, related_name='segment_words', to='quiz.newword')),
            ],
            options={
        'db_table': 'segment_words',
            },
        ),
        
    # Word Translations テーブル
        migrations.CreateModel(
            name='NewWordTranslation',
            fields=[
                ('word_translation_id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('text_ja', models.TextField()),
                ('is_correct', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('word_id', models.ForeignKey(db_column='word_id', on_delete=django.db.models.deletion.CASCADE, related_name='translations', to='quiz.newword')),
            ],
            options={
        'db_table': 'word_translations',
            },
        ),
        
    # Word Choices テーブル
        migrations.CreateModel(
            name='NewWordChoice',
            fields=[
                ('word_choice_id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('text_ja', models.TextField()),
                ('is_correct', models.BooleanField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('word_id', models.ForeignKey(db_column='word_id', on_delete=django.db.models.deletion.CASCADE, related_name='choices', to='quiz.newword')),
            ],
            options={
        'db_table': 'word_choices',
            },
        ),
        
        # 制約とインデックス
        migrations.AddConstraint(
            model_name='segment',
            constraint=models.CheckConstraint(check=models.Q(publish_status__in=['draft', 'published', 'archived']), name='segments_publish_status_check'),
        ),
        migrations.AddConstraint(
            model_name='segmentword',
            constraint=models.CheckConstraint(check=models.Q(question_order__gte=1, question_order__lte=10), name='segment_words_question_order_check'),
        ),
        migrations.AddConstraint(
            model_name='segmentword',
            constraint=models.UniqueConstraint(fields=('segment_id', 'question_order'), name='segment_words_segment_order_unique'),
        ),
        migrations.AddConstraint(
            model_name='segmentword',
            constraint=models.UniqueConstraint(fields=('segment_id', 'word_id'), name='segment_words_segment_word_unique'),
        ),
        migrations.AddConstraint(
            model_name='newwordtranslation',
            constraint=models.UniqueConstraint(fields=('word_id', 'text_ja'), name='word_translations_word_text_unique'),
        ),
        migrations.AddConstraint(
            model_name='newwordchoice',
            constraint=models.UniqueConstraint(fields=('word_id', 'text_ja'), name='word_choices_word_text_unique'),
        ),
        
        # インデックス
        migrations.AddIndex(
            model_name='newwordchoice',
            index=models.Index(fields=['word_id'], name='ix_word_choices_word'),
        ),
        migrations.AddIndex(
            model_name='newwordchoice',
            index=models.Index(fields=['word_id', 'is_correct'], name='ix_word_choices_word_correct'),
        ),
        
        # トリガー関数とトリガの作成（PostgreSQL用）
        migrations.RunSQL(
            """
            CREATE OR REPLACE FUNCTION set_updated_at()
            RETURNS TRIGGER LANGUAGE plpgsql AS $$
            BEGIN
                NEW.updated_at := NOW();
                RETURN NEW;
            END $$;
            """,
            reverse_sql="DROP FUNCTION IF EXISTS set_updated_at();"
        ),
        
        migrations.RunSQL(
            """
            CREATE TRIGGER trg_levels_updated
            BEFORE UPDATE ON levels
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
            """,
            reverse_sql="DROP TRIGGER IF EXISTS trg_levels_updated ON levels;"
        ),
        
        migrations.RunSQL(
            """
            CREATE TRIGGER trg_segments_updated
            BEFORE UPDATE ON segments
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
            """,
            reverse_sql="DROP TRIGGER IF EXISTS trg_segments_updated ON segments;"
        ),
        
        migrations.RunSQL(
            """
            CREATE TRIGGER trg_words_updated
            BEFORE UPDATE ON words
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
            """,
            reverse_sql="DROP TRIGGER IF EXISTS trg_words_updated ON words;"
        ),
        
        # 公開ガード関数とトリガ（10問チェック）
        migrations.RunSQL(
            """
            CREATE OR REPLACE FUNCTION guard_segment_publish()
            RETURNS TRIGGER LANGUAGE plpgsql AS $$
            DECLARE
                cnt INT;
            BEGIN
                IF (NEW.publish_status = 'published' AND OLD.publish_status <> 'published') THEN
                    SELECT COUNT(*) INTO cnt FROM segment_words WHERE segment_id = NEW.segment_id;
                    IF cnt <> 10 THEN
                        RAISE EXCEPTION 'Segment % must have exactly 10 questions to publish (current: %)', NEW.segment_id, cnt;
                    END IF;
                END IF;
                RETURN NEW;
            END $$;
            """,
            reverse_sql="DROP FUNCTION IF EXISTS guard_segment_publish();"
        ),
        
        migrations.RunSQL(
            """
            CREATE TRIGGER trg_segments_publish_guard
            BEFORE UPDATE ON segments
            FOR EACH ROW EXECUTE FUNCTION guard_segment_publish();
            """,
            reverse_sql="DROP TRIGGER IF EXISTS trg_segments_publish_guard ON segments;"
        ),
    ]
