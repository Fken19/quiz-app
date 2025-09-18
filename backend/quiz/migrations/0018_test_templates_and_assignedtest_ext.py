from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("quiz", "0017_add_groupmembership_attrs"),
    ]

    operations = [
        migrations.RunSQL(
            sql=r'''
            DO $$
            DECLARE
                wtype text;
            BEGIN
                -- Create quiz_testtemplate if missing
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name='quiz_testtemplate'
                ) THEN
                    CREATE TABLE "quiz_testtemplate" (
                        "id" uuid NOT NULL PRIMARY KEY,
                        "owner_id" uuid NOT NULL REFERENCES "quiz_user" ("id") DEFERRABLE INITIALLY DEFERRED,
                        "title" varchar(200) NOT NULL,
                        "description" varchar(500) NULL DEFAULT '',
                        "default_timer_seconds" integer NULL,
                        "created_at" timestamp with time zone NOT NULL,
                        "updated_at" timestamp with time zone NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS quiz_testtemplate_owner_created_idx ON "quiz_testtemplate" ("owner_id", "created_at");
                END IF;

                -- Create quiz_testtemplateitem if missing
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name='quiz_testtemplateitem'
                ) THEN
                    -- Detect the type of quiz_word.id to align FK column type
                    SELECT data_type INTO wtype
                    FROM information_schema.columns
                    WHERE table_name='quiz_word' AND column_name='id'
                    LIMIT 1;

                    IF wtype = 'uuid' THEN
                        EXECUTE 'CREATE TABLE "quiz_testtemplateitem" (
                                "id" uuid NOT NULL PRIMARY KEY,
                                "template_id" uuid NOT NULL REFERENCES "quiz_testtemplate" ("id") DEFERRABLE INITIALLY DEFERRED,
                                "word_id" uuid NOT NULL REFERENCES "quiz_word" ("id") DEFERRABLE INITIALLY DEFERRED,
                                "order" integer NOT NULL DEFAULT 0,
                                "choices" jsonb NULL,
                                "created_at" timestamp with time zone NOT NULL
                            )';
                    ELSIF wtype IN ('bigint', 'integer') THEN
                        EXECUTE 'CREATE TABLE "quiz_testtemplateitem" (
                                "id" uuid NOT NULL PRIMARY KEY,
                                "template_id" uuid NOT NULL REFERENCES "quiz_testtemplate" ("id") DEFERRABLE INITIALLY DEFERRED,
                                "word_id" bigint NOT NULL REFERENCES "quiz_word" ("id") DEFERRABLE INITIALLY DEFERRED,
                                "order" integer NOT NULL DEFAULT 0,
                                "choices" jsonb NULL,
                                "created_at" timestamp with time zone NOT NULL
                            )';
                    ELSE
                        RAISE EXCEPTION 'Unsupported data type for quiz_word.id: %', wtype;
                    END IF;

                    EXECUTE 'CREATE INDEX IF NOT EXISTS quiz_testtemplateitem_tmpl_order_idx ON "quiz_testtemplateitem" ("template_id", "order")';
                END IF;

                -- Extend quiz_assignedtest with template_id and timer_seconds if missing
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name='quiz_assignedtest'
                ) THEN
                    ALTER TABLE "quiz_assignedtest" ADD COLUMN IF NOT EXISTS "template_id" uuid NULL;
                    ALTER TABLE "quiz_assignedtest" ADD COLUMN IF NOT EXISTS "timer_seconds" integer NULL;
                    -- Add FK after column exists (skip if already set)
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints c
                        WHERE c.table_name='quiz_assignedtest' AND c.constraint_type='FOREIGN KEY' AND c.constraint_name='quiz_assignedtest_template_id_fkey'
                    ) THEN
                        ALTER TABLE "quiz_assignedtest"
                        ADD CONSTRAINT "quiz_assignedtest_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "quiz_testtemplate" ("id") DEFERRABLE INITIALLY DEFERRED;
                    END IF;
                END IF;
            END
            $$;
            ''',
            reverse_sql=r'''
            DO $$
            BEGIN
                -- Reverse: drop added columns and tables if exist
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name='quiz_assignedtest'
                ) THEN
                    -- Drop FK if exists, then columns
                    IF EXISTS (
                        SELECT 1 FROM information_schema.table_constraints c
                        WHERE c.table_name='quiz_assignedtest' AND c.constraint_type='FOREIGN KEY' AND c.constraint_name='quiz_assignedtest_template_id_fkey'
                    ) THEN
                        ALTER TABLE "quiz_assignedtest" DROP CONSTRAINT "quiz_assignedtest_template_id_fkey";
                    END IF;
                    ALTER TABLE "quiz_assignedtest" DROP COLUMN IF EXISTS "template_id";
                    ALTER TABLE "quiz_assignedtest" DROP COLUMN IF EXISTS "timer_seconds";
                END IF;

                -- Drop child first due to FK
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name='quiz_testtemplateitem'
                ) THEN
                    DROP TABLE IF EXISTS "quiz_testtemplateitem" CASCADE;
                END IF;
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name='quiz_testtemplate'
                ) THEN
                    DROP TABLE IF EXISTS "quiz_testtemplate" CASCADE;
                END IF;
            END
            $$;
            ''',
        )
    ]
