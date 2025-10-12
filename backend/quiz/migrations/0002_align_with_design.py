from django.db import migrations, models


def set_tags_default(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute("ALTER TABLE student_teacher_links ALTER COLUMN tags SET DEFAULT '[]'::jsonb")


def unset_tags_default(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute("ALTER TABLE student_teacher_links ALTER COLUMN tags DROP DEFAULT")


def enforce_userprofile_not_null(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute("ALTER TABLE users_profile ALTER COLUMN display_name SET NOT NULL")
        schema_editor.execute("ALTER TABLE users_profile ALTER COLUMN avatar_url SET NOT NULL")


def relax_userprofile_not_null(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute("ALTER TABLE users_profile ALTER COLUMN display_name DROP NOT NULL")
        schema_editor.execute("ALTER TABLE users_profile ALTER COLUMN avatar_url DROP NOT NULL")


class Migration(migrations.Migration):

    dependencies = [
        ("quiz", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="studentteacherlink",
            name="tags",
            field=models.JSONField(blank=True, default=list, null=True),
        ),
        migrations.RunPython(set_tags_default, unset_tags_default),
        migrations.RunPython(enforce_userprofile_not_null, relax_userprofile_not_null),
    ]
