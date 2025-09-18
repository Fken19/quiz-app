from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('quiz', '0008_map_quizset_table'),
    ]

    operations = [
        # 既存DBのテーブル名差異に対応するため、条件付きでインデックスを作成
        # quiz_item(word_id)
        migrations.RunSQL(
            sql=r'''
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='quiz_quiz_item') THEN
                    CREATE INDEX IF NOT EXISTS quiz_item_word_idx ON "quiz_quiz_item" ("word_id");
                ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='quiz_quizitem') THEN
                    CREATE INDEX IF NOT EXISTS quiz_item_word_idx ON "quiz_quizitem" ("word_id");
                END IF;
            END
            $$;
            ''',
            reverse_sql=r'''
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_class WHERE relname='quiz_item_word_idx') THEN
                    DROP INDEX IF EXISTS quiz_item_word_idx;
                END IF;
            END
            $$;
            '''
        ),
        # quiz_response(user_id, created_at)
        migrations.RunSQL(
            sql=r'''
            DO $$
            BEGIN
                -- Create index only if table AND required columns exist
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='quiz_quiz_response')
                   AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quiz_quiz_response' AND column_name='user_id')
                   AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quiz_quiz_response' AND column_name='created_at') THEN
                    CREATE INDEX IF NOT EXISTS quiz_resp_user_created_idx ON "quiz_quiz_response" ("user_id", "created_at");
                ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='quiz_quizresponse')
                   AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quiz_quizresponse' AND column_name='user_id')
                   AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quiz_quizresponse' AND column_name='created_at') THEN
                    CREATE INDEX IF NOT EXISTS quiz_resp_user_created_idx ON "quiz_quizresponse" ("user_id", "created_at");
                END IF;
            END
            $$;
            ''',
            reverse_sql=r'''
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_class WHERE relname='quiz_resp_user_created_idx') THEN
                    DROP INDEX IF EXISTS quiz_resp_user_created_idx;
                END IF;
            END
            $$;
            '''
        ),
        # quiz_response(quiz_item_id)
        migrations.RunSQL(
            sql=r'''
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='quiz_quiz_response')
                   AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quiz_quiz_response' AND column_name='quiz_item_id') THEN
                    CREATE INDEX IF NOT EXISTS quiz_resp_item_idx ON "quiz_quiz_response" ("quiz_item_id");
                ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='quiz_quizresponse')
                   AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quiz_quizresponse' AND column_name='quiz_item_id') THEN
                    CREATE INDEX IF NOT EXISTS quiz_resp_item_idx ON "quiz_quizresponse" ("quiz_item_id");
                END IF;
            END
            $$;
            ''',
            reverse_sql=r'''
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_class WHERE relname='quiz_resp_item_idx') THEN
                    DROP INDEX IF EXISTS quiz_resp_item_idx;
                END IF;
            END
            $$;
            '''
        ),
    ]
