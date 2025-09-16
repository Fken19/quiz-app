from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("quiz", "0008_map_quizset_table"),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                """
                -- Drop columns if they exist to revert to minimal schema
                ALTER TABLE IF EXISTS "quiz_whitelist_user" DROP COLUMN IF EXISTS "full_name";
                ALTER TABLE IF EXISTS "quiz_whitelist_user" DROP COLUMN IF EXISTS "school";
                ALTER TABLE IF EXISTS "quiz_whitelist_user" DROP COLUMN IF EXISTS "grade";
                ALTER TABLE IF EXISTS "quiz_whitelist_user" DROP COLUMN IF EXISTS "is_active";
                ALTER TABLE IF EXISTS "quiz_whitelist_user" DROP COLUMN IF EXISTS "updated_at";
                """
            ),
            reverse_sql=(
                """
                -- No-op reverse (these columns were optional)
                """
            ),
        )
    ]
