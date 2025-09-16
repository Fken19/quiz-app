from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('quiz', '0008_map_quizset_table'),
    ]

    operations = [
        # quiz_quiz_item(word_id) にインデックス
        migrations.AddIndex(
            model_name='quizitem',
            index=models.Index(fields=['word'], name='quiz_item_word_idx'),
        ),
        # quiz_quiz_response(user_id, created_at) 複合インデックス（最新2件抽出の ORDER BY サポート）
        migrations.AddIndex(
            model_name='quizresponse',
            index=models.Index(fields=['user', 'created_at'], name='quiz_resp_user_created_idx'),
        ),
        # 念のため、結合に使う quiz_item_id にもインデックス（外部キーで作成されていない環境向け）
        migrations.AddIndex(
            model_name='quizresponse',
            index=models.Index(fields=['quiz_item'], name='quiz_resp_item_idx'),
        ),
    ]
