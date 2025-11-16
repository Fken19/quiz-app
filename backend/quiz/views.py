"""新スキーマ用APIビュー"""

from __future__ import annotations

import uuid
from typing import Any

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

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

    def perform_update(self, serializer):  # type: ignore[override]
        quiz_result: models.QuizResult = serializer.instance.quiz_result
        if quiz_result.user_id != self.request.user.id:
            raise PermissionDenied("Quiz result does not belong to the current user.")
        serializer.save()


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
    "InvitationCodeViewSet",
    "StudentTeacherLinkViewSet",
    "RosterFolderViewSet",
    "RosterMembershipViewSet",
    "VocabularyViewSet",
    "VocabTranslationViewSet",
    "VocabChoiceViewSet",
    "QuizCollectionViewSet",
    "QuizViewSet",
    "QuizQuestionViewSet",
    "QuizResultViewSet",
    "QuizResultDetailViewSet",
    "TestViewSet",
    "TestQuestionViewSet",
    "TestAssignmentViewSet",
    "TestAssigneeViewSet",
    "TestResultViewSet",
    "TestResultDetailViewSet",
    "debug_create_user",
]
