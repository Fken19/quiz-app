from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('quiz', '0007_auto_20250914_1729'),
    ]

    operations = [
        # This migration documents that QuizSet now maps to existing table
        migrations.AlterModelTable(
            name='quizset',
            table='quiz_quiz_set',
        ),
    ]
