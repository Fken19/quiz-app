from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0016_fix_missing_daily_stats_tables'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                """
                ALTER TABLE IF EXISTS quiz_groupmembership
                ADD COLUMN IF NOT EXISTS attr1 VARCHAR(100) NOT NULL DEFAULT '';

                ALTER TABLE IF EXISTS quiz_groupmembership
                ADD COLUMN IF NOT EXISTS attr2 VARCHAR(100) NOT NULL DEFAULT '';

                CREATE INDEX IF NOT EXISTS quiz_gm_attr1_idx ON quiz_groupmembership (attr1);
                CREATE INDEX IF NOT EXISTS quiz_gm_attr2_idx ON quiz_groupmembership (attr2);
                """
            ),
            reverse_sql=(
                """
                -- Safe reverse: drop indexes and columns if exist
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'quiz_gm_attr1_idx') THEN
                        EXECUTE 'DROP INDEX IF EXISTS quiz_gm_attr1_idx';
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'quiz_gm_attr2_idx') THEN
                        EXECUTE 'DROP INDEX IF EXISTS quiz_gm_attr2_idx';
                    END IF;
                END $$;
                ALTER TABLE IF EXISTS quiz_groupmembership DROP COLUMN IF EXISTS attr1;
                ALTER TABLE IF EXISTS quiz_groupmembership DROP COLUMN IF EXISTS attr2;
                """
            ),
        ),
    ]
