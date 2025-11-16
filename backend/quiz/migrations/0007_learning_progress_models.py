import uuid

from django.db import migrations, models
import django.db.models.deletion
from django.utils import timezone


class Migration(migrations.Migration):

    dependencies = [
        ("quiz", "0006_remove_user_groups_remove_user_user_permissions"),
    ]

    operations = [
        migrations.AddField(
            model_name="quizcollection",
            name="level_code",
            field=models.CharField(blank=True, max_length=32, null=True),
        ),
        migrations.AddField(
            model_name="quizcollection",
            name="level_label",
            field=models.CharField(blank=True, max_length=120, null=True),
        ),
        migrations.AddField(
            model_name="quizcollection",
            name="level_order",
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name="quiz",
            name="section_label",
            field=models.CharField(blank=True, max_length=120, null=True),
        ),
        migrations.AddField(
            model_name="quiz",
            name="section_no",
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="quizresult",
            name="question_count",
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name="quizresult",
            name="timeout_count",
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name="quizresultdetail",
            name="is_timeout",
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name="LearningActivityLog",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        db_column="learning_activity_log_id",
                    ),
                ),
                ("occurred_at", models.DateTimeField(default=timezone.now)),
                ("correct_count", models.IntegerField(default=0)),
                ("incorrect_count", models.IntegerField(default=0)),
                ("timeout_count", models.IntegerField(default=0)),
                ("total_time_ms", models.IntegerField(default=0)),
                (
                    "quiz_result",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="activity_logs",
                        to="quiz.quizresult",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="learning_activity_logs",
                        to="quiz.user",
                    ),
                ),
            ],
            options={
                "db_table": "learning_activity_logs",
            },
        ),
        migrations.CreateModel(
            name="LearningSummaryDaily",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        db_column="learning_summary_daily_id",
                    ),
                ),
                ("activity_date", models.DateField()),
                ("correct_count", models.IntegerField(default=0)),
                ("incorrect_count", models.IntegerField(default=0)),
                ("timeout_count", models.IntegerField(default=0)),
                ("total_time_ms", models.IntegerField(default=0)),
                ("streak_count", models.IntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="learning_summary_daily",
                        to="quiz.user",
                    ),
                ),
            ],
            options={
                "db_table": "learning_summary_daily",
            },
        ),
        migrations.CreateModel(
            name="UserVocabStatus",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        db_column="user_vocab_status_id",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("unlearned", "unlearned"),
                            ("weak", "weak"),
                            ("learning", "learning"),
                            ("mastered", "mastered"),
                        ],
                        default="unlearned",
                        max_length=16,
                    ),
                ),
                (
                    "last_result",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("correct", "correct"),
                            ("incorrect", "incorrect"),
                            ("timeout", "timeout"),
                        ],
                        max_length=16,
                        null=True,
                    ),
                ),
                ("last_answered_at", models.DateTimeField(blank=True, null=True)),
                ("recent_correct_streak", models.IntegerField(default=0)),
                ("total_answer_count", models.IntegerField(default=0)),
                ("total_correct_count", models.IntegerField(default=0)),
                ("timeout_count", models.IntegerField(default=0)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="vocab_statuses",
                        to="quiz.user",
                    ),
                ),
                (
                    "vocabulary",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="user_statuses",
                        to="quiz.vocabulary",
                    ),
                ),
            ],
            options={
                "db_table": "user_vocab_statuses",
            },
        ),
        migrations.AddConstraint(
            model_name="uservocabstatus",
            constraint=models.UniqueConstraint(fields=("user", "vocabulary"), name="user_vocab_status_unique"),
        ),
        migrations.AddConstraint(
            model_name="learningsummarydaily",
            constraint=models.UniqueConstraint(fields=("user", "activity_date"), name="learning_summary_daily_unique"),
        ),
        migrations.AddConstraint(
            model_name="quizcollection",
            constraint=models.UniqueConstraint(
                condition=models.Q(
                    ("level_code__isnull", False),
                    ("archived_at__isnull", True),
                ),
                fields=("scope", "level_code"),
                name="quiz_collection_level_unique",
            ),
        ),
        migrations.AddIndex(
            model_name="quizcollection",
            index=models.Index(fields=["level_code"], name="qc_level_code_idx"),
        ),
        migrations.AddIndex(
            model_name="quizcollection",
            index=models.Index(fields=["level_order"], name="qc_level_order_idx"),
        ),
        migrations.AddIndex(
            model_name="quiz",
            index=models.Index(fields=["section_no"], name="quiz_section_idx"),
        ),
        migrations.AddIndex(
            model_name="learningactivitylog",
            index=models.Index(fields=["user", "occurred_at"], name="lal_user_occurred_idx"),
        ),
        migrations.AddIndex(
            model_name="learningactivitylog",
            index=models.Index(fields=["quiz_result"], name="lal_quiz_result_idx"),
        ),
        migrations.AddIndex(
            model_name="learningsummarydaily",
            index=models.Index(fields=["user", "activity_date"], name="lsd_user_date_idx"),
        ),
        migrations.AddIndex(
            model_name="uservocabstatus",
            index=models.Index(fields=["user", "status"], name="uvs_user_status_idx"),
        ),
        migrations.AddIndex(
            model_name="uservocabstatus",
            index=models.Index(fields=["vocabulary"], name="uvs_vocab_idx"),
        ),
        migrations.AddIndex(
            model_name="uservocabstatus",
            index=models.Index(fields=["last_answered_at"], name="uvs_last_answered_idx"),
        ),
    ]
