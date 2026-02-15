"""
Django Management Command: Duplicate a Test with all TestQuestions.

Usage:
    python manage.py duplicate_test <source_test_id> [--title-suffix " (B)"]
    python manage.py duplicate_test <source_test_id> --new-title "Custom Title"
    python manage.py duplicate_test <source_test_id> --dry-run
    python manage.py duplicate_test <source_test_id> --force

Options:
    --title-suffix TEXT       Append this to original title (default: " (copy)")
    --new-title TEXT          Custom title for new test (overrides suffix)
    --dry-run                 Print what would happen, don't create
    --force                   Allow duplicate title (default: fail if exists)

Examples:
    # Create Test B with suffix
    python manage.py duplicate_test d86eb90e-2944-44cf-9813-3c1b59e89ff5 --title-suffix " (B)"
    
    # Preview without creating
    python manage.py duplicate_test d86eb90e-2944-44cf-9813-3c1b59e89ff5 --dry-run
    
    # Force create even if same title exists
    python manage.py duplicate_test d86eb90e-2944-44cf-9813-3c1b59e89ff5 --force
"""

import uuid
from typing import Optional

from django.core.management.base import BaseCommand, CommandError

from quiz.models import Test, TestQuestion


class Command(BaseCommand):
    help = "Duplicate a Test with all its TestQuestions (no assignments/results)"

    def add_arguments(self, parser):
        parser.add_argument(
            "source_test_id",
            type=str,
            help="UUID of the test to duplicate",
        )
        parser.add_argument(
            "--title-suffix",
            type=str,
            default=" (copy)",
            help='Append this to original title (default: " (copy)")',
        )
        parser.add_argument(
            "--new-title",
            type=str,
            default=None,
            help="Custom title for new test (overrides suffix)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would happen, don't create",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Allow duplicate title (default: fail if exists)",
        )

    def handle(self, *args, **options):
        source_id = options["source_test_id"]
        title_suffix = options["title_suffix"]
        new_title = options["new_title"]
        dry_run = options["dry_run"]
        force = options["force"]

        # Fetch original test
        try:
            original_test = Test.objects.get(id=source_id)
        except Test.DoesNotExist:
            raise CommandError(f"Test with ID '{source_id}' not found")

        # Fetch questions
        test_questions = original_test.questions.all().order_by("question_order")
        if not test_questions.exists():
            raise CommandError(f"Original test has no questions")

        # Determine new title
        if new_title:
            final_title = new_title
        else:
            final_title = original_test.title + title_suffix

        # Check if title already exists (unless --force)
        if not force:
            if Test.objects.filter(title=final_title).exists():
                raise CommandError(
                    f"Test with title '{final_title}' already exists. "
                    f"Use --new-title or --force to override."
                )

        # Dry-run: just print
        if dry_run:
            self.stdout.write(
                self.style.WARNING("DRY-RUN: No test created, preview only:")
            )
            self.stdout.write(f"  Original Test: {original_test.id} ({original_test.title})")
            self.stdout.write(f"  New Title:     {final_title}")
            self.stdout.write(f"  Questions:     {test_questions.count()} will be copied")
            self.stdout.write(f"  Teacher:       {original_test.teacher.email}")
            return

        # Create new test
        try:
            new_test = Test.objects.create(
                id=uuid.uuid4(),
                teacher=original_test.teacher,
                title=final_title,
                description=original_test.description,
                due_at=original_test.due_at,
                max_attempts_per_student=original_test.max_attempts_per_student,
            )

            # Copy all TestQuestions
            for old_question in test_questions:
                TestQuestion.objects.create(
                    id=uuid.uuid4(),
                    test=new_test,
                    vocabulary=old_question.vocabulary,
                    question_order=old_question.question_order,
                    weight=old_question.weight,
                    timer_seconds=old_question.timer_seconds,
                )

            # Success message
            self.stdout.write(self.style.SUCCESS("✅ Test duplicated successfully"))
            self.stdout.write(f"  Original Test: {original_test.id}")
            self.stdout.write(f"    Title: {original_test.title}")
            self.stdout.write(f"  New Test:      {new_test.id}")
            self.stdout.write(f"    Title: {final_title}")
            self.stdout.write(f"  Questions:     {test_questions.count()} copied")
            self.stdout.write(f"  Teacher:       {original_test.teacher.email}")

        except Exception as e:
            raise CommandError(f"Failed to create test: {type(e).__name__}: {str(e)}")
