"""
新しいクイズスキーマ用のマイグレーション - Phase 2: Quiz Session & Results Tables
"""
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0014_create_new_schema_core_tables'),
    ]

    operations = [
        # QuizSession テーブル（セグメントベース）
        migrations.CreateModel(
            name='NewQuizSession',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('total_time_ms', models.IntegerField(blank=True, null=True)),
                ('score', models.IntegerField(default=0)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='quiz_sessions', to='quiz.user')),
                ('segment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='quiz_sessions', to='quiz.segment')),
            ],
            options={
                'db_table': 'quiz_new_quiz_sessions',
            },
        ),
        
        # QuizResult テーブル（問題単位）
        migrations.CreateModel(
            name='NewQuizResult',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('question_order', models.IntegerField()),
                ('selected_text', models.TextField()),
                ('is_correct', models.BooleanField()),
                ('reaction_time_ms', models.IntegerField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='results', to='quiz.newquizsession')),
                ('word', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='quiz.newword')),
                ('selected_choice', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='quiz.newwordchoice')),
            ],
            options={
                'db_table': 'quiz_new_quiz_results',
            },
        ),
        
        # 統計テーブル
        migrations.CreateModel(
            name='NewDailyUserStats',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField()),
                ('sessions_count', models.IntegerField(default=0)),
                ('questions_attempted', models.IntegerField(default=0)),
                ('questions_correct', models.IntegerField(default=0)),
                ('total_time_ms', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='daily_stats', to='quiz.user')),
            ],
            options={
                'db_table': 'quiz_new_dailyuserstats',
            },
        ),
        
        migrations.CreateModel(
            name='NewDailyGroupStats',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField()),
                ('sessions_count', models.IntegerField(default=0)),
                ('questions_attempted', models.IntegerField(default=0)),
                ('questions_correct', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('group', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='daily_stats', to='quiz.group')),
            ],
            options={
                'db_table': 'quiz_new_dailygroupstats',
            },
        ),
        
        # インデックス
        migrations.AddIndex(
            model_name='newquizsession',
            index=models.Index(fields=['user', 'started_at'], name='quiz_new_quizsession_user_started_idx'),
        ),
        migrations.AddIndex(
            model_name='newquizsession',
            index=models.Index(fields=['segment'], name='quiz_new_quizsession_segment_idx'),
        ),
        migrations.AddIndex(
            model_name='newquizresult',
            index=models.Index(fields=['session'], name='quiz_new_quizresult_session_idx'),
        ),
        migrations.AddIndex(
            model_name='newquizresult',
            index=models.Index(fields=['word'], name='quiz_new_quizresult_word_idx'),
        ),
        migrations.AddIndex(
            model_name='newquizresult',
            index=models.Index(fields=['created_at'], name='quiz_new_quizresult_created_idx'),
        ),
        migrations.AddIndex(
            model_name='newdailyuserstats',
            index=models.Index(fields=['date', 'user'], name='quiz_new_dailyuserstats_date_user_idx'),
        ),
        migrations.AddIndex(
            model_name='newdailygroupstats',
            index=models.Index(fields=['date', 'group'], name='quiz_new_dailygroupstats_date_group_idx'),
        ),
        
        # 制約
        migrations.AddConstraint(
            model_name='newquizresult',
            constraint=models.UniqueConstraint(fields=('session', 'question_order'), name='unique_new_session_question_order'),
        ),
        migrations.AddConstraint(
            model_name='newdailyuserstats',
            constraint=models.UniqueConstraint(fields=('date', 'user'), name='unique_new_daily_user_stats'),
        ),
        migrations.AddConstraint(
            model_name='newdailygroupstats',
            constraint=models.UniqueConstraint(fields=('date', 'group'), name='unique_new_daily_group_stats'),
        ),
    ]
