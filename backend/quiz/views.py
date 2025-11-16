"""新スキーマ用APIビュー"""

from __future__ import annotations

import random
import uuid
from datetime import timedelta
from typing import Any

from django.db.models import Count, Max, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from . import models, serializers


class StandardResultsSetPagination(PageNumberPagination):
    page_size_query_param = "page_size"
    max_page_size = 200


class BaseModelViewSet(viewsets.ModelViewSet):
    pagination_class = StandardResultsSetPagination


class UserViewSet(BaseModelViewSet):
    queryset = models.User.objects.all().order_by("created_at")
    serializer_class = serializers.UserSerializer

    def get_permissions(self):
        if self.action in {"list", "create", "destroy"}:
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        user = self.request.user
        # 一般ユーザーは自分のレコードのみ閲覧可能
        # 講師権限の判定はTeacherAccessControlMiddlewareで行われる
        if user.is_authenticated:
            from .utils import is_teacher_whitelisted
            if not is_teacher_whitelisted(user.email):
                qs = qs.filter(pk=user.pk)
        return qs

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated], url_path="me")
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)


class UserProfileViewSet(BaseModelViewSet):
    serializer_class = serializers.UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        return models.UserProfile.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):  # type: ignore[override]
        serializer.save(user=self.request.user)


class TeacherViewSet(BaseModelViewSet):
    queryset = models.Teacher.objects.all().order_by("created_at")
    serializer_class = serializers.TeacherSerializer

    def get_permissions(self):
        if self.action in {"create", "destroy"}:
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated], url_path="me")
    def me(self, request):
        teacher = getattr(request, "teacher", None)
        if teacher is None:
            teacher = get_object_or_404(models.Teacher, email__iexact=request.user.email)
        serializer = self.get_serializer(teacher)
        return Response(serializer.data)


class TeacherProfileViewSet(BaseModelViewSet):
    serializer_class = serializers.TeacherProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        teacher = getattr(self.request, "teacher", None)
        qs = models.TeacherProfile.objects.select_related("teacher")
        if teacher is None:
            return qs.none()
        return qs.filter(teacher=teacher)

    def perform_create(self, serializer):
        serializer.save(teacher=self._require_teacher())

    def perform_update(self, serializer):  # type: ignore[override]
        serializer.save(teacher=self._require_teacher())

    def _require_teacher(self):
        teacher = getattr(self.request, "teacher", None)
        if teacher is None:
            raise PermissionDenied("講師情報が解決できません。")
        return teacher


class TeacherWhitelistViewSet(BaseModelViewSet):
    queryset = models.TeacherWhitelist.objects.all().order_by("created_at")
    serializer_class = serializers.TeacherWhitelistSerializer
    permission_classes = [permissions.IsAdminUser]


class InvitationCodeViewSet(BaseModelViewSet):
    queryset = models.InvitationCode.objects.all().order_by("issued_at")
    serializer_class = serializers.InvitationCodeSerializer
    permission_classes = [permissions.IsAuthenticated]


class StudentTeacherLinkViewSet(BaseModelViewSet):
    serializer_class = serializers.StudentTeacherLinkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        user = self.request.user
        qs = models.StudentTeacherLink.objects.select_related("teacher", "student").order_by("-linked_at")

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        # 講師はホワイトリスト判定、生徒は自分の関連のみ
        from .utils import is_teacher_whitelisted
        if is_teacher_whitelisted(user.email):
            return qs
        return qs.filter(Q(student=user) | Q(teacher__email=user.email))


class RosterFolderViewSet(BaseModelViewSet):
    serializer_class = serializers.RosterFolderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        return models.RosterFolder.objects.select_related("owner_teacher", "parent_folder").order_by("name")


class RosterMembershipViewSet(BaseModelViewSet):
    serializer_class = serializers.RosterMembershipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        return models.RosterMembership.objects.select_related("roster_folder", "student").order_by("-added_at")


class VocabularyViewSet(BaseModelViewSet):
    queryset = models.Vocabulary.objects.all().order_by("sort_key")
    serializer_class = serializers.VocabularySerializer
    permission_classes = [permissions.IsAuthenticated]


class VocabTranslationViewSet(BaseModelViewSet):
    queryset = models.VocabTranslation.objects.select_related("vocabulary").order_by("-created_at")
    serializer_class = serializers.VocabTranslationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        vocab_id = self.request.query_params.get("vocabulary")
        if vocab_id:
            qs = qs.filter(vocabulary_id=vocab_id)
        return qs


class VocabChoiceViewSet(BaseModelViewSet):
    queryset = models.VocabChoice.objects.select_related("vocabulary", "source_vocabulary").order_by("-created_at")
    serializer_class = serializers.VocabChoiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        vocab_id = self.request.query_params.get("vocabulary")
        if vocab_id:
            qs = qs.filter(vocabulary_id=vocab_id)
        return qs


class QuizCollectionViewSet(BaseModelViewSet):
    queryset = models.QuizCollection.objects.select_related("owner_user", "origin_collection").order_by("order_index")
    serializer_class = serializers.QuizCollectionSerializer
    permission_classes = [permissions.IsAuthenticated]


class QuizViewSet(BaseModelViewSet):
    queryset = models.Quiz.objects.select_related("quiz_collection", "origin_quiz").order_by("sequence_no")
    serializer_class = serializers.QuizSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        collection_id = self.request.query_params.get("quiz_collection")
        if collection_id:
            qs = qs.filter(quiz_collection_id=collection_id)
        return qs


class QuizQuestionViewSet(BaseModelViewSet):
    queryset = models.QuizQuestion.objects.select_related("quiz", "vocabulary").order_by("question_order")
    serializer_class = serializers.QuizQuestionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        quiz_id = self.request.query_params.get("quiz")
        if quiz_id:
            qs = qs.filter(quiz_id=quiz_id)
        vocabulary_id = self.request.query_params.get("vocabulary")
        if vocabulary_id:
            qs = qs.filter(vocabulary_id=vocabulary_id)
        return qs


class QuizResultViewSet(BaseModelViewSet):
    serializer_class = serializers.QuizResultSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        return models.QuizResult.objects.select_related("user", "quiz").filter(user=self.request.user).order_by("-started_at")

    def perform_create(self, serializer):  # type: ignore[override]
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):  # type: ignore[override]
        serializer.save(user=self.request.user)


class QuizResultDetailViewSet(BaseModelViewSet):
    serializer_class = serializers.QuizResultDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        return models.QuizResultDetail.objects.select_related("quiz_result", "vocabulary").filter(
            quiz_result__user=self.request.user
        ).order_by("question_order")

    def perform_create(self, serializer):  # type: ignore[override]
        quiz_result: models.QuizResult = serializer.validated_data["quiz_result"]
        if quiz_result.user_id != self.request.user.id:
            raise PermissionDenied("Quiz result does not belong to the current user.")
        serializer.save()


class StudentDashboardSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.localdate()
        seven_days_ago = today - timedelta(days=6)

        daily_qs = models.LearningSummaryDaily.objects.filter(
            user=user,
            activity_date__range=(seven_days_ago, today),
        )
        daily_map = {entry.activity_date: entry for entry in daily_qs}

        # Today summary and weekly aggregate
        today_entry = daily_map.get(today)
        today_summary = {
            "correct_count": today_entry.correct_count if today_entry else 0,
            "incorrect_count": today_entry.incorrect_count if today_entry else 0,
            "timeout_count": today_entry.timeout_count if today_entry else 0,
            "total_time_ms": today_entry.total_time_ms if today_entry else 0,
        }
        weekly_totals = daily_qs.aggregate(
            correct=Sum("correct_count"),
            incorrect=Sum("incorrect_count"),
            timeout=Sum("timeout_count"),
            time_ms=Sum("total_time_ms"),
        )
        weekly_summary = {
            "correct_count": weekly_totals["correct"] or 0,
            "incorrect_count": weekly_totals["incorrect"] or 0,
            "timeout_count": weekly_totals["timeout"] or 0,
            "total_time_ms": weekly_totals["time_ms"] or 0,
        }

        chart_data = []
        max_daily_total = 0
        for offset in range(7):
            day = seven_days_ago + timedelta(days=offset)
            entry = daily_map.get(day)
            chart_item = {
                "date": day.isoformat(),
                "correct_count": entry.correct_count if entry else 0,
                "incorrect_count": entry.incorrect_count if entry else 0,
                "timeout_count": entry.timeout_count if entry else 0,
            }
            chart_data.append(chart_item)
            max_daily_total = max(
                max_daily_total,
                chart_item["correct_count"] + chart_item["incorrect_count"] + chart_item["timeout_count"],
            )

        # Streak
        latest_entry = (
            models.LearningSummaryDaily.objects.filter(user=user).order_by("-activity_date").first()
        )
        current_streak = latest_entry.streak_count if latest_entry else 0
        best_streak = (
            models.LearningSummaryDaily.objects.filter(user=user).aggregate(best=Max("streak_count"))["best"] or 0
        )

        # Focus summary counts
        status_rows = (
            models.UserVocabStatus.objects.filter(user=user)
            .values("status")
            .annotate(count=Count("id"))
        )
        status_count_map = {row["status"]: row["count"] for row in status_rows}

        total_vocab_candidates = models.Vocabulary.objects.filter(
            visibility=models.VocabVisibility.PUBLIC,
            status=models.VocabStatus.PUBLISHED,
        )
        total_vocab = total_vocab_candidates.count()
        studied_total = sum(status_count_map.values())
        unlearned_count = max(total_vocab - studied_total, 0)

        focus_summary = {
            "unlearned": {"count": unlearned_count},
            "weak": {"count": status_count_map.get(models.LearningStatus.WEAK, 0)},
            "learning": {"count": status_count_map.get(models.LearningStatus.LEARNING, 0)},
            "mastered": {"count": status_count_map.get(models.LearningStatus.MASTERED, 0)},
        }

        quiz_result_count = models.QuizResult.objects.filter(user=user).count()
        test_result_count = models.TestResult.objects.filter(student=user).count()
        pending_tests = (
            models.TestAssignee.objects.filter(student=user)
            .exclude(
                test__results__student=user,
                test__results__completed_at__isnull=False,
            )
            .distinct()
            .count()
        )

        summary = {
            "user": serializers.UserSerializer(user, context={"request": request}).data,
            "streak": {
                "current": current_streak,
                "best": best_streak,
            },
            "today_summary": today_summary,
            "weekly_summary": weekly_summary,
            "recent_daily": {
                "chart": chart_data,
                "max_total": max_daily_total,
            },
            "focus_summary": focus_summary,
            "quiz_result_count": quiz_result_count,
            "test_result_count": test_result_count,
            "pending_tests": pending_tests,
        }
        return Response(summary)


class FocusQuestionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        status_param = request.query_params.get("status", models.LearningStatus.WEAK)
        limit_param = request.query_params.get("limit", "10")
        try:
            limit = max(1, min(int(limit_param), 100))
        except (TypeError, ValueError):
            return Response({"detail": "limit は整数で指定してください"}, status=status.HTTP_400_BAD_REQUEST)

        if status_param not in models.LearningStatus.values:
            return Response({"detail": "status が不正です"}, status=status.HTTP_400_BAD_REQUEST)

        vocabulary_ids: list[str] = []
        preview: list[dict[str, Any]] = []
        available_count = 0

        if status_param == models.LearningStatus.UNLEARNED:
            vocab_qs = (
                models.Vocabulary.objects.filter(
                    visibility=models.VocabVisibility.PUBLIC,
                    status=models.VocabStatus.PUBLISHED,
                )
                .exclude(user_statuses__user=user)
                .order_by("sort_key")
            )
            available_count = vocab_qs.count()
            selected = list(vocab_qs[:limit])
            vocabulary_ids = [str(vocab.id) for vocab in selected]
            preview = [{"vocabulary_id": str(vocab.id), "text_en": vocab.text_en} for vocab in selected]
        else:
            status_qs = (
                models.UserVocabStatus.objects.filter(user=user, status=status_param)
                .order_by("last_answered_at")
            )
            available_count = status_qs.count()
            selected_ids = list(status_qs.values_list("vocabulary_id", flat=True)[:limit])
            vocabulary_ids = [str(v_id) for v_id in selected_ids]
            vocab_map = {
                str(vocab.id): vocab
                for vocab in models.Vocabulary.objects.filter(id__in=selected_ids)
            }
            preview = []
            for vocab_id in vocabulary_ids:
                vocab_obj = vocab_map.get(vocab_id)
                preview.append(
                    {
                        "vocabulary_id": vocab_id,
                        "text_en": vocab_obj.text_en if vocab_obj else None,
                    }
                )

        data = {
            "status": status_param,
            "requested_limit": limit,
            "available_count": available_count,
            "vocabulary_ids": vocabulary_ids,
            "preview": preview,
        }
        return Response(data)


class FocusQuizSessionStartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        vocabulary_ids = request.data.get("vocabulary_ids") or []
        if not isinstance(vocabulary_ids, list) or not vocabulary_ids:
            return Response({"detail": "vocabulary_ids は1件以上の配列で指定してください"}, status=status.HTTP_400_BAD_REQUEST)

        vocab_qs = models.Vocabulary.objects.filter(id__in=vocabulary_ids)
        vocab_map = {str(vocab.id): vocab for vocab in vocab_qs}
        ordered_vocabs = []
        for vocab_id in vocabulary_ids:
            vocab = vocab_map.get(str(vocab_id))
            if vocab:
                ordered_vocabs.append(vocab)
        if not ordered_vocabs:
            return Response({"detail": "指定された語彙が見つかりません"}, status=status.HTTP_400_BAD_REQUEST)

        collection, _ = models.QuizCollection.objects.get_or_create(
            scope=models.QuizScope.CUSTOM,
            owner_user=user,
            title="フォーカス学習",
            defaults={
                "description": "フォーカス学習セッション",
                "is_published": False,
                "order_index": 1000,
            },
        )
        max_seq = collection.quizzes.aggregate(max_seq=Max("sequence_no"))["max_seq"] or 0
        quiz = models.Quiz.objects.create(
            quiz_collection=collection,
            sequence_no=max_seq + 1,
            title=f"フォーカス({timezone.localtime().strftime('%m/%d %H:%M')})",
            timer_seconds=10,
        )

        quiz_questions = [
            models.QuizQuestion(
                quiz=quiz,
                vocabulary=vocab,
                question_order=index,
            )
            for index, vocab in enumerate(ordered_vocabs, start=1)
        ]
        models.QuizQuestion.objects.bulk_create(quiz_questions)

        return Response(
            {
                "quiz_id": str(quiz.id),
                "question_count": len(ordered_vocabs),
            },
            status=status.HTTP_201_CREATED,
        )


class QuizSessionStartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        quiz_id = request.data.get("quiz") or request.data.get("quiz_id")
        if not quiz_id:
            return Response({"detail": "quizは必須です"}, status=status.HTTP_400_BAD_REQUEST)

        quiz = get_object_or_404(
            models.Quiz.objects.select_related("quiz_collection"),
            pk=quiz_id,
            archived_at__isnull=True,
        )
        questions = list(
            models.QuizQuestion.objects.select_related("vocabulary")
            .filter(quiz=quiz, archived_at__isnull=True)
            .order_by("question_order")
        )
        if not questions:
            return Response({"detail": "このクイズには問題が登録されていません"}, status=status.HTTP_400_BAD_REQUEST)

        vocab_ids = list({question.vocabulary_id for question in questions})
        choices_qs = models.VocabChoice.objects.filter(vocabulary_id__in=vocab_ids)
        choices_map: dict[str, list[models.VocabChoice]] = {}
        for choice in choices_qs:
            key = str(choice.vocabulary_id)
            choices_map.setdefault(key, []).append(choice)

        question_payloads: list[dict[str, Any]] = []
        for question in questions:
            vocab = question.vocabulary
            vocab_key = str(vocab.id)
            vocab_choices = choices_map.get(vocab_key, [])
            if not vocab_choices:
                return Response(
                    {"detail": f"{vocab.text_en} の選択肢が不足しています"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            shuffled_choices = [
                {
                    "vocab_choice_id": str(choice.id),
                    "text_ja": choice.text_ja,
                }
                for choice in vocab_choices
            ]
            random.shuffle(shuffled_choices)
            question_payloads.append(
                {
                    "quiz_question_id": str(question.id),
                    "question_order": question.question_order,
                    "vocabulary": {
                        "vocabulary_id": str(vocab.id),
                        "text_en": vocab.text_en,
                        "part_of_speech": vocab.part_of_speech,
                        "explanation": vocab.explanation,
                    },
                    "choices": shuffled_choices,
                }
            )

        timer_seconds = quiz.timer_seconds or 10
        quiz_result = models.QuizResult.objects.create(
            user=request.user,
            quiz=quiz,
            question_count=len(question_payloads),
            timeout_count=0,
            total_time_ms=0,
            score=0,
        )

        quiz_payload = {
            "quiz_id": str(quiz.id),
            "title": quiz.title,
            "sequence_no": quiz.sequence_no,
            "timer_seconds": timer_seconds,
        }

        data = {
            "quiz_result_id": str(quiz_result.id),
            "quiz": quiz_payload,
            "questions": question_payloads,
            "question_count": len(question_payloads),
            "timer_seconds": timer_seconds,
        }
        return Response(data, status=status.HTTP_201_CREATED)


class QuizSessionAnswerView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, quiz_result_id: uuid.UUID):
        quiz_result = get_object_or_404(
            models.QuizResult.objects.select_related("quiz"),
            pk=quiz_result_id,
            user=request.user,
        )
        if quiz_result.completed_at:
            return Response({"detail": "このセッションは既に完了しています"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            question_order = int(request.data.get("question_order"))
        except (TypeError, ValueError):
            return Response({"detail": "question_order が不正です"}, status=status.HTTP_400_BAD_REQUEST)

        if models.QuizResultDetail.objects.filter(quiz_result=quiz_result, question_order=question_order).exists():
            return Response({"detail": "この設問はすでに回答済みです"}, status=status.HTTP_409_CONFLICT)

        question = get_object_or_404(
            models.QuizQuestion.objects.select_related("vocabulary"),
            quiz=quiz_result.quiz,
            question_order=question_order,
            archived_at__isnull=True,
        )

        choice_id = request.data.get("choice_id")
        choice = None
        if choice_id:
            choice = get_object_or_404(
                models.VocabChoice,
                pk=choice_id,
                vocabulary=question.vocabulary,
            )

        elapsed_ms_raw = request.data.get("elapsed_ms")
        elapsed_ms = None
        if elapsed_ms_raw is not None:
            try:
                elapsed_ms = max(0, int(elapsed_ms_raw))
            except (TypeError, ValueError):
                return Response({"detail": "elapsed_ms が不正です"}, status=status.HTTP_400_BAD_REQUEST)

        timer_seconds = quiz_result.quiz.timer_seconds or 10
        timer_ms = timer_seconds * 1000
        is_timeout = elapsed_ms is None or elapsed_ms >= timer_ms
        selected_text = choice.text_ja if choice else None
        is_correct = bool(choice and choice.is_correct and not is_timeout)
        reaction_time_ms = timer_ms if elapsed_ms is None else min(elapsed_ms, timer_ms)

        detail = models.QuizResultDetail.objects.create(
            quiz_result=quiz_result,
            question_order=question_order,
            vocabulary=question.vocabulary,
            selected_text=selected_text,
            is_correct=is_correct,
            is_timeout=is_timeout,
            reaction_time_ms=reaction_time_ms,
        )

        update_fields = ["total_time_ms"]
        quiz_result.total_time_ms = (quiz_result.total_time_ms or 0) + (detail.reaction_time_ms or 0)
        if is_timeout:
            quiz_result.timeout_count = (quiz_result.timeout_count or 0) + 1
            update_fields.append("timeout_count")
        if is_correct:
            quiz_result.score = (quiz_result.score or 0) + 1
            update_fields.append("score")
        quiz_result.save(update_fields=update_fields)

        correct_choice = (
            models.VocabChoice.objects.filter(vocabulary=question.vocabulary, is_correct=True).first()
        )
        correct_choice_payload = None
        if correct_choice:
            correct_choice_payload = {
                "vocab_choice_id": str(correct_choice.id),
                "text_ja": correct_choice.text_ja,
            }

        response_payload = {
            "quiz_result_id": str(quiz_result.id),
            "question_order": question_order,
            "is_correct": is_correct,
            "is_timeout": is_timeout,
            "reaction_time_ms": detail.reaction_time_ms,
            "selected_text": detail.selected_text,
            "correct_choice": correct_choice_payload,
        }
        return Response(response_payload, status=status.HTTP_201_CREATED)


class QuizSessionCompleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, quiz_result_id: uuid.UUID):
        quiz_result = get_object_or_404(
            models.QuizResult.objects.select_related("quiz"),
            pk=quiz_result_id,
            user=request.user,
        )
        total_questions = quiz_result.question_count or 0
        answered_count = quiz_result.details.count()
        if total_questions == 0 or answered_count != total_questions:
            return Response({"detail": "未回答の設問があります"}, status=status.HTTP_400_BAD_REQUEST)

        if not quiz_result.completed_at:
            aggregates = quiz_result.details.aggregate(
                correct_count=Count("id", filter=Q(is_correct=True)),
                timeout_count=Count("id", filter=Q(is_timeout=True)),
                total_time=Sum("reaction_time_ms"),
            )
            quiz_result.score = aggregates["correct_count"] or 0
            quiz_result.timeout_count = aggregates["timeout_count"] or 0
            quiz_result.total_time_ms = aggregates["total_time"] or 0
            quiz_result.completed_at = timezone.now()
            quiz_result.save(update_fields=["score", "timeout_count", "total_time_ms", "completed_at"])
            self._record_activity_and_statuses(quiz_result)

        serializer = serializers.QuizResultSerializer(quiz_result, context={"request": request})
        return Response(serializer.data)

    def _record_activity_and_statuses(self, quiz_result: models.QuizResult):
        """学習履歴と語彙ステータスを更新"""
        user = quiz_result.user
        today = timezone.localdate()

        correct_count = quiz_result.details.filter(is_correct=True).count()
        incorrect_count = quiz_result.details.filter(is_correct=False, is_timeout=False).count()
        timeout_count = quiz_result.details.filter(is_timeout=True).count()
        total_time_ms = quiz_result.total_time_ms or 0

        models.LearningActivityLog.objects.create(
            user=user,
            quiz_result=quiz_result,
            occurred_at=quiz_result.completed_at or timezone.now(),
            correct_count=correct_count,
            incorrect_count=incorrect_count,
            timeout_count=timeout_count,
            total_time_ms=total_time_ms,
        )

        summary, _ = models.LearningSummaryDaily.objects.get_or_create(
            user=user,
            activity_date=today,
            defaults={
                "correct_count": 0,
                "incorrect_count": 0,
                "timeout_count": 0,
                "total_time_ms": 0,
                "streak_count": 0,
            },
        )
        summary.correct_count += correct_count
        summary.incorrect_count += incorrect_count
        summary.timeout_count += timeout_count
        summary.total_time_ms += total_time_ms

        yesterday = today - timedelta(days=1)
        yesterday_entry = models.LearningSummaryDaily.objects.filter(user=user, activity_date=yesterday).first()
        previous_streak = yesterday_entry.streak_count if yesterday_entry else 0
        summary.streak_count = previous_streak + 1
        summary.save()

        detail_rows = quiz_result.details.select_related("vocabulary")
        status_objects = models.UserVocabStatus.objects.filter(
            user=user, vocabulary_id__in=[detail.vocabulary_id for detail in detail_rows]
        )
        status_map = {status.vocabulary_id: status for status in status_objects}

        for detail in detail_rows:
            status_obj = status_map.get(detail.vocabulary_id)
            if not status_obj:
                status_obj = models.UserVocabStatus.objects.create(
                    user=user,
                    vocabulary=detail.vocabulary,
                    status=models.LearningStatus.UNLEARNED,
                )
                status_map[detail.vocabulary_id] = status_obj

            status_obj.last_answered_at = quiz_result.completed_at or timezone.now()
            status_obj.total_answer_count += 1
            if detail.is_timeout:
                status_obj.timeout_count += 1
                status_obj.last_result = models.LearningResultType.TIMEOUT
                status_obj.recent_correct_streak = 0
                status_obj.status = models.LearningStatus.WEAK
            elif detail.is_correct:
                status_obj.total_correct_count += 1
                status_obj.last_result = models.LearningResultType.CORRECT
                status_obj.recent_correct_streak = min(status_obj.recent_correct_streak + 1, 2)
                if status_obj.recent_correct_streak >= 2:
                    status_obj.status = models.LearningStatus.MASTERED
                else:
                    status_obj.status = models.LearningStatus.LEARNING
            else:
                status_obj.last_result = models.LearningResultType.INCORRECT
                status_obj.recent_correct_streak = 0
                status_obj.status = models.LearningStatus.WEAK
            status_obj.save()

    def perform_update(self, serializer):  # type: ignore[override]
        quiz_result: models.QuizResult = serializer.instance.quiz_result
        if quiz_result.user_id != self.request.user.id:
            raise PermissionDenied("Quiz result does not belong to the current user.")
        serializer.save()


class UserVocabStatusViewSet(BaseModelViewSet):
    serializer_class = serializers.UserVocabStatusSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        return models.UserVocabStatus.objects.select_related("vocabulary").filter(user=self.request.user).order_by("-updated_at")

    def perform_create(self, serializer):  # type: ignore[override]
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):  # type: ignore[override]
        if serializer.instance.user_id != self.request.user.id:
            raise PermissionDenied("Status does not belong to the current user.")
        serializer.save(user=self.request.user)


class LearningActivityLogViewSet(BaseModelViewSet):
    serializer_class = serializers.LearningActivityLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        return models.LearningActivityLog.objects.select_related("quiz_result").filter(user=self.request.user).order_by("-occurred_at")

    def perform_create(self, serializer):  # type: ignore[override]
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):  # type: ignore[override]
        if serializer.instance.user_id != self.request.user.id:
            raise PermissionDenied("Activity log does not belong to the current user.")
        serializer.save(user=self.request.user)


class LearningSummaryDailyViewSet(BaseModelViewSet):
    serializer_class = serializers.LearningSummaryDailySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        return models.LearningSummaryDaily.objects.filter(user=self.request.user).order_by("-activity_date")

    def perform_create(self, serializer):  # type: ignore[override]
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):  # type: ignore[override]
        if serializer.instance.user_id != self.request.user.id:
            raise PermissionDenied("Summary does not belong to the current user.")
        serializer.save(user=self.request.user)


class TestViewSet(BaseModelViewSet):
    queryset = models.Test.objects.select_related("teacher").order_by("-created_at")
    serializer_class = serializers.TestSerializer
    permission_classes = [permissions.IsAuthenticated]


class TestQuestionViewSet(BaseModelViewSet):
    queryset = models.TestQuestion.objects.select_related("test", "vocabulary").order_by("question_order")
    serializer_class = serializers.TestQuestionSerializer
    permission_classes = [permissions.IsAuthenticated]


class TestAssignmentViewSet(BaseModelViewSet):
    queryset = models.TestAssignment.objects.select_related("test", "assigned_by_teacher").order_by("-assigned_at")
    serializer_class = serializers.TestAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]


class TestAssigneeViewSet(BaseModelViewSet):
    queryset = models.TestAssignee.objects.select_related(
        "test",
        "student",
        "test_assignment",
        "source_folder",
        "assigned_by_teacher",
    ).order_by("-assigned_at")
    serializer_class = serializers.TestAssigneeSerializer
    permission_classes = [permissions.IsAuthenticated]


class TestResultViewSet(BaseModelViewSet):
    serializer_class = serializers.TestResultSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        return models.TestResult.objects.select_related("test", "student").filter(student=self.request.user).order_by("-started_at")


class TestResultDetailViewSet(BaseModelViewSet):
    serializer_class = serializers.TestResultDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        return models.TestResultDetail.objects.select_related("test_result", "vocabulary").filter(
            test_result__student=self.request.user
        ).order_by("question_order")


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def debug_create_user(request):
    email = (request.data.get("email") or "").strip().lower()
    name = (request.data.get("name") or "").strip()
    if not email:
        return Response({"error": "email is required"}, status=status.HTTP_400_BAD_REQUEST)

    user, created = models.User.objects.get_or_create(
        email=email,
        defaults={
            "oauth_provider": "debug",
            "oauth_sub": f"debug:{uuid.uuid4()}",
            "is_active": True,
        },
    )

    display_name = name or email
    models.UserProfile.objects.update_or_create(
        user=user,
        defaults={
            "display_name": display_name,
            "avatar_url": "",
        },
    )

    token, _ = Token.objects.get_or_create(user=user)
    data: dict[str, Any] = {
        "access_token": token.key,
        "user_id": str(user.pk),
        "created": created,
    }
    return Response(data)


__all__ = [
    "UserViewSet",
    "UserProfileViewSet",
    "TeacherViewSet",
    "TeacherProfileViewSet",
    "TeacherWhitelistViewSet",
    "FocusQuestionView",
    "FocusQuizSessionStartView",
    "InvitationCodeViewSet",
    "StudentTeacherLinkViewSet",
    "RosterFolderViewSet",
    "RosterMembershipViewSet",
    "VocabularyViewSet",
    "VocabTranslationViewSet",
    "VocabChoiceViewSet",
    "LearningActivityLogViewSet",
    "LearningSummaryDailyViewSet",
    "QuizCollectionViewSet",
    "QuizViewSet",
    "QuizQuestionViewSet",
    "QuizResultViewSet",
    "QuizResultDetailViewSet",
    "StudentDashboardSummaryView",
    "UserVocabStatusViewSet",
    "TestViewSet",
    "TestQuestionViewSet",
    "TestAssignmentViewSet",
    "TestAssigneeViewSet",
    "TestResultViewSet",
    "TestResultDetailViewSet",
    "debug_create_user",
]
