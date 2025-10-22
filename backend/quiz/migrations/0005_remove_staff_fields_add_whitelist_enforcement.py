# Generated migration to align with design specification

from django.db import migrations, models
import uuid


def migrate_superusers_to_teachers_and_whitelist(apps, schema_editor):
    """
    既存のis_staff=Trueまたはis_superuser=Trueのユーザーを
    teachersテーブルとteachers_whitelistsに移行
    """
    User = apps.get_model('quiz', 'User')
    Teacher = apps.get_model('quiz', 'Teacher')
    TeacherWhitelist = apps.get_model('quiz', 'TeacherWhitelist')
    
    # is_staffまたはis_superuserのユーザーを取得
    admin_users = User.objects.filter(models.Q(is_staff=True) | models.Q(is_superuser=True))
    
    for user in admin_users:
        # Teacherレコードを作成または取得
        teacher, created = Teacher.objects.get_or_create(
            email=user.email,
            defaults={
                'oauth_provider': user.oauth_provider,
                'oauth_sub': user.oauth_sub + '_teacher',  # 重複を避けるためサフィックス追加
                'created_at': user.created_at,
            }
        )
        
        # ホワイトリストに追加
        TeacherWhitelist.objects.get_or_create(
            email=user.email.lower(),
            defaults={
                'can_publish_vocab': True,  # スーパーユーザーには公開権限を付与
                'note': f'Migrated from superuser/staff (user_id: {user.id})',
                'created_by': None,
            }
        )


def reverse_migration(apps, schema_editor):
    """
    ロールバック時の処理（データは保持）
    """
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0004_alter_user_email_user_users_email_active_uniq'),
    ]

    operations = [
        # 既存データを移行
        migrations.RunPython(migrate_superusers_to_teachers_and_whitelist, reverse_migration),
        
        # is_staffとis_superuserフィールドを削除
        migrations.RemoveField(
            model_name='user',
            name='is_staff',
        ),
        migrations.RemoveField(
            model_name='user',
            name='is_superuser',
        ),
    ]
