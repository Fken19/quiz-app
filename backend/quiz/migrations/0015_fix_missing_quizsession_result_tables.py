from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("quiz", "0014_fix_missing_assignedtest_table"),
    ]

    operations = [
        migrations.RunSQL(
            sql=r'''
            DO $$
            BEGIN
                -- Create quiz_quizsession if missing (matches models.QuizSession minimal schema)
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name='quiz_quizsession'
                ) THEN
                    CREATE TABLE "quiz_quizsession" (
                        "id" uuid NOT NULL PRIMARY KEY,
                        "user_id" uuid NOT NULL,
                        "test_id" uuid NULL,
                        "started_at" timestamp with time zone NOT NULL,
                        "completed_at" timestamp with time zone NULL,
                        "total_time_ms" integer NULL
                    );
                    -- Add helpful indexes
                    CREATE INDEX IF NOT EXISTS quiz_quizsession_user_started_idx ON "quiz_quizsession" ("user_id", "started_at");
                    -- FK to users (best-effort) and assigned tests
                    BEGIN
                        EXECUTE 'ALTER TABLE "quiz_quizsession" ADD CONSTRAINT quiz_quizsession_user_fk FOREIGN KEY ("user_id") REFERENCES "quiz_user" ("id") DEFERRABLE INITIALLY DEFERRED';
                    EXCEPTION WHEN others THEN
                        -- Swallow if quiz_user doesn't exist under that name
                        NULL;
                    END;
                    BEGIN
                        EXECUTE 'ALTER TABLE "quiz_quizsession" ADD CONSTRAINT quiz_quizsession_test_fk FOREIGN KEY ("test_id") REFERENCES "quiz_assignedtest" ("id") DEFERRABLE INITIALLY DEFERRED';
                    EXCEPTION WHEN others THEN
                        NULL;
                    END;
                END IF;

                -- Create quiz_quizresult if missing (matches models.QuizResult minimal schema)
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name='quiz_quizresult'
                ) THEN
                    CREATE TABLE "quiz_quizresult" (
                        "id" uuid NOT NULL PRIMARY KEY,
                        "session_id" uuid NOT NULL,
                        "question_id" uuid NOT NULL,
                        "chosen_option_id" uuid NULL,
                        "is_correct" boolean NOT NULL,
                        "elapsed_ms" integer NULL,
                        "created_at" timestamp with time zone NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS quiz_quizresult_session_idx ON "quiz_quizresult" ("session_id");
                    CREATE INDEX IF NOT EXISTS quiz_quizresult_created_idx ON "quiz_quizresult" ("created_at");
                    -- Add FK to quiz_quizsession only (question/option FKs may not exist in legacy DB)
                    BEGIN
                        EXECUTE 'ALTER TABLE "quiz_quizresult" ADD CONSTRAINT quiz_quizresult_session_fk FOREIGN KEY ("session_id") REFERENCES "quiz_quizsession" ("id") DEFERRABLE INITIALLY DEFERRED';
                    EXCEPTION WHEN others THEN
                        NULL;
                    END;
                END IF;
            END
            $$;
            ''',
            reverse_sql=r'''
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name='quiz_quizresult'
                ) THEN
                    DROP TABLE IF EXISTS "quiz_quizresult" CASCADE;
                END IF;
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name='quiz_quizsession'
                ) THEN
                    DROP TABLE IF EXISTS "quiz_quizsession" CASCADE;
                END IF;
            END
            $$;
            ''',
        )
    ]
