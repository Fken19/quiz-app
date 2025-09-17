from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("quiz", "0015_fix_missing_quizsession_result_tables"),
    ]

    operations = [
        migrations.RunSQL(
            sql=r'''
            DO $$
            BEGIN
                -- Create quiz_dailygroupstats if missing
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name='quiz_dailygroupstats'
                ) THEN
                    CREATE TABLE "quiz_dailygroupstats" (
                        "id" bigserial PRIMARY KEY,
                        "date" date NOT NULL,
                        "group_id" uuid NOT NULL,
                        "attempts" integer NOT NULL DEFAULT 0,
                        "correct" integer NOT NULL DEFAULT 0,
                        "created_at" timestamp with time zone NOT NULL
                    );
                    CREATE UNIQUE INDEX IF NOT EXISTS quiz_dailygroupstats_uniq ON "quiz_dailygroupstats" ("date", "group_id");
                    CREATE INDEX IF NOT EXISTS quiz_dailygroupstats_date_group_idx ON "quiz_dailygroupstats" ("date", "group_id");
                    BEGIN
                        EXECUTE 'ALTER TABLE "quiz_dailygroupstats" ADD CONSTRAINT quiz_dailygroupstats_group_fk FOREIGN KEY ("group_id") REFERENCES "quiz_group" ("id") DEFERRABLE INITIALLY DEFERRED';
                    EXCEPTION WHEN others THEN
                        NULL;
                    END;
                END IF;

                -- Create quiz_dailyuserstats if missing
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name='quiz_dailyuserstats'
                ) THEN
                    CREATE TABLE "quiz_dailyuserstats" (
                        "id" bigserial PRIMARY KEY,
                        "date" date NOT NULL,
                        "user_id" uuid NOT NULL,
                        "attempts" integer NOT NULL DEFAULT 0,
                        "correct" integer NOT NULL DEFAULT 0,
                        "total_time_ms" integer NOT NULL DEFAULT 0,
                        "created_at" timestamp with time zone NOT NULL
                    );
                    CREATE UNIQUE INDEX IF NOT EXISTS quiz_dailyuserstats_uniq ON "quiz_dailyuserstats" ("date", "user_id");
                    CREATE INDEX IF NOT EXISTS quiz_dailyuserstats_date_user_idx ON "quiz_dailyuserstats" ("date", "user_id");
                    BEGIN
                        EXECUTE 'ALTER TABLE "quiz_dailyuserstats" ADD CONSTRAINT quiz_dailyuserstats_user_fk FOREIGN KEY ("user_id") REFERENCES "quiz_user" ("id") DEFERRABLE INITIALLY DEFERRED';
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
                    SELECT 1 FROM information_schema.tables WHERE table_name='quiz_dailyuserstats'
                ) THEN
                    DROP TABLE IF EXISTS "quiz_dailyuserstats" CASCADE;
                END IF;
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name='quiz_dailygroupstats'
                ) THEN
                    DROP TABLE IF EXISTS "quiz_dailygroupstats" CASCADE;
                END IF;
            END
            $$;
            ''',
        )
    ]
