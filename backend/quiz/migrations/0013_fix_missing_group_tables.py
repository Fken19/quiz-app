from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("quiz", "0012_merge_0009_perf_indexes_0011_groups_and_alias"),
    ]

    operations = [
        migrations.RunSQL(
            sql=r'''
            DO $$
            BEGIN
                -- Create quiz_group if missing
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name='quiz_group'
                ) THEN
                    CREATE TABLE "quiz_group" (
                        "id" uuid NOT NULL PRIMARY KEY,
                        "name" varchar(100) NOT NULL,
                        "owner_admin_id" uuid NOT NULL REFERENCES "quiz_user" ("id") DEFERRABLE INITIALLY DEFERRED,
                        "created_at" timestamp with time zone NOT NULL,
                        "updated_at" timestamp with time zone NOT NULL
                    );
                    -- Unique constraint per owner_admin + name
                    ALTER TABLE "quiz_group" ADD CONSTRAINT "quiz_group_owner_admin_id_name_uniq" UNIQUE ("owner_admin_id", "name");
                    -- Helpful indexes
                    CREATE INDEX IF NOT EXISTS quiz_group_owner_idx ON "quiz_group" ("owner_admin_id");
                    CREATE INDEX IF NOT EXISTS quiz_group_name_idx ON "quiz_group" ("name");
                END IF;

                -- Create quiz_groupmembership if missing
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name='quiz_groupmembership'
                ) THEN
                    CREATE TABLE "quiz_groupmembership" (
                        "id" uuid NOT NULL PRIMARY KEY,
                        "group_id" uuid NOT NULL REFERENCES "quiz_group" ("id") DEFERRABLE INITIALLY DEFERRED,
                        "user_id" uuid NOT NULL REFERENCES "quiz_user" ("id") DEFERRABLE INITIALLY DEFERRED,
                        "role" varchar(20) NOT NULL,
                        "created_at" timestamp with time zone NOT NULL
                    );
                    ALTER TABLE "quiz_groupmembership" ADD CONSTRAINT "quiz_groupmembership_group_id_user_id_uniq" UNIQUE ("group_id", "user_id");
                END IF;
            END
            $$;
            ''',
            reverse_sql=r'''
            DO $$
            BEGIN
                -- Drop only if exists (no-op if managed elsewhere)
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='quiz_groupmembership') THEN
                    DROP TABLE IF EXISTS "quiz_groupmembership" CASCADE;
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='quiz_group') THEN
                    DROP TABLE IF EXISTS "quiz_group" CASCADE;
                END IF;
            END
            $$;
            ''',
        )
    ]
