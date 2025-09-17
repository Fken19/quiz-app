from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("quiz", "0013_fix_missing_group_tables"),
    ]

    operations = [
        migrations.RunSQL(
            sql=r'''
            DO $$
            BEGIN
                -- Create quiz_assignedtest if missing (matches models.AssignedTest)
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name='quiz_assignedtest'
                ) THEN
                    CREATE TABLE "quiz_assignedtest" (
                        "id" uuid NOT NULL PRIMARY KEY,
                        "group_id" uuid NOT NULL REFERENCES "quiz_group" ("id") DEFERRABLE INITIALLY DEFERRED,
                        "title" varchar(200) NOT NULL,
                        "due_at" timestamp with time zone NULL,
                        "created_at" timestamp with time zone NOT NULL
                    );
                    -- Helpful index on group
                    CREATE INDEX IF NOT EXISTS quiz_assignedtest_group_idx ON "quiz_assignedtest" ("group_id");
                END IF;
            END
            $$;
            ''',
            reverse_sql=r'''
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name='quiz_assignedtest'
                ) THEN
                    DROP TABLE IF EXISTS "quiz_assignedtest" CASCADE;
                END IF;
            END
            $$;
            ''',
        )
    ]
