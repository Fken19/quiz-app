"""
新しいクイズスキーマ用のマイグレーション - Phase 3: Legacy Compatibility Tables
"""
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0015_create_new_schema_session_results'),
    ]

    operations = [
        # レガシー互換テーブル：既存のquiz_quiz_setテーブルに新しい関連を追加
        migrations.AddField(
            model_name='quizset',
            name='quiz_session',
            field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='legacy_quiz_set', to='quiz.quizsession'),
        ),
        
        # レガシー互換テーブル：既存のquiz_quiz_itemテーブルに新しい関連を追加
        migrations.AddField(
            model_name='quizitem',
            name='quiz_result',
            field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='legacy_quiz_item', to='quiz.quizresult'),
        ),
        
        # 新スキーマから既存データを参照するためのビュー作成（必要に応じて）
        migrations.RunSQL(
            """
            CREATE OR REPLACE VIEW quiz_legacy_compatibility AS
            SELECT 
                qs.id as quiz_set_id,
                qs.id as quiz_set_uuid,
                qs.user_id,
                qsession.id as session_id,
                qsession.started_at,
                qsession.completed_at
            FROM quiz_quiz_set qs
            LEFT JOIN quiz_quizsession qsession ON qs.quiz_session_id = qsession.id;
            """,
            reverse_sql="DROP VIEW IF EXISTS quiz_legacy_compatibility;"
        ),
    ]
