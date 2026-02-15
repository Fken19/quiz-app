#!/usr/bin/env python
"""
Duplicate a Test with all its TestQuestions.

Usage:
    python manage.py shell < /path/to/duplicate_test.py
    or:
    source /path/to/venv/bin/activate
    cd backend
    python manage.py shell
    >>> exec(open('scripts/duplicate_test.py').read())

Then inside the shell:
    >>> original_test_id = "725ffa45-..."
    >>> new_test_title = "E2E_Quiz_TestB"
    >>> duplicate_test_with_questions(original_test_id, new_test_title)

---

Purpose:
  * Copy all TestQuestion (vocabulary, order, weight, timer) to new Test
  * Create fresh Test with new ID
  * Do NOT copy TestAssignment, TestAssignee, TestResult (those are result data)

Result:
  * New Test has identical structure (questions, order, weights)
  * New Test is empty of assignments/results
  * Same teacher ownership preserved
"""

import uuid
from django.utils import timezone
from quiz.models import Test, TestQuestion


def duplicate_test_with_questions(original_test_id: str, new_test_title: str) -> dict:
    """
    Duplicate a Test and all its TestQuestions.
    
    Args:
        original_test_id: UUID of the test to duplicate (string or UUID)
        new_test_title: Title for the new test
        
    Returns:
        Dictionary with result info: {
            "success": bool,
            "original_id": str,
            "new_id": str,
            "question_count": int,
            "message": str,
            "error": str (if failed)
        }
    """
    try:
        # Fetch original test
        try:
            original_test = Test.objects.get(id=original_test_id)
        except Test.DoesNotExist:
            return {
                "success": False,
                "error": f"Test with ID '{original_test_id}' not found",
                "original_id": str(original_test_id)
            }
        
        # Fetch all TestQuestions
        test_questions = original_test.questions.all().order_by('question_order')
        if not test_questions.exists():
            return {
                "success": False,
                "error": f"Original test has no questions (test_id={original_test_id})",
                "original_id": str(original_test_id)
            }
        
        # Create new Test
        new_test = Test.objects.create(
            id=uuid.uuid4(),
            teacher=original_test.teacher,
            title=new_test_title,
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
        
        result = {
            "success": True,
            "original_id": str(original_test.id),
            "new_id": str(new_test.id),
            "question_count": test_questions.count(),
            "new_test_title": new_test_title,
            "teacher_email": original_test.teacher.email,
            "message": f"Duplicated test successfully: {original_test.title} → {new_test_title}"
        }
        
        print(f"✅ SUCCESS")
        print(f"  Original Test: {original_test.id} ({original_test.title})")
        print(f"  New Test:      {new_test.id} ({new_test_title})")
        print(f"  Questions:     {test_questions.count()} copied")
        print(f"  Teacher:       {original_test.teacher.email}")
        
        return result
        
    except Exception as e:
        error_msg = f"Unexpected error: {type(e).__name__}: {str(e)}"
        print(f"❌ ERROR: {error_msg}")
        return {
            "success": False,
            "error": error_msg,
            "original_id": str(original_test_id)
        }


# Example usage (uncomment to run):
if __name__ == "__main__":
    # Replace these with actual values
    ORIGINAL_TEST_ID = "725ffa45-..."  # Set this
    NEW_TEST_TITLE = "E2E_Quiz_TestB"  # Set this
    
    result = duplicate_test_with_questions(ORIGINAL_TEST_ID, NEW_TEST_TITLE)
    print(f"\nResult: {result}")
