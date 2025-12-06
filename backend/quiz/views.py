"""新スキーマ用APIビュー"""

from __future__ import annotations

import random
import uuid
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.core.cache import caches
from django.core.files.storage import default_storage
from django.db.models import Count, Max, Prefetch, Q, Sum, F, OuterRef, Subquery, Exists
from django.db.models.functions import TruncMonth, TruncWeek
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
import logging

from . import models, serializers
logger = logging.getLogger(__name__)
from .utils import is_teacher_whitelisted, parse_date_param
from django.db import transaction


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


class AvatarUploadView(APIView):
    """
    ユーザー/講師のアバターをアップロードするエンドポイント
    - target=student（既定）: UserProfile.avatar_url を更新
    - target=teacher: TeacherProfile.avatar_url を更新（講師ホワイトリスト必須）
    """

    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from .utils import is_teacher_whitelisted

        upload_for = request.data.get("target", "student")
        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "ファイルが指定されていません。"}, status=status.HTTP_400_BAD_REQUEST)

        content_type = (file.content_type or "").lower()
        if content_type not in {"image/png", "image/jpeg", "image/jpg"}:
            return Response({"detail": "png または jpeg 画像のみアップロードできます。"}, status=status.HTTP_400_BAD_REQUEST)

        suffix = ".png" if "png" in content_type else ".jpg"
        filename = f"avatars/{request.user.id}/{uuid.uuid4()}{suffix}"
        saved_path = default_storage.save(filename, file)
        public_url = default_storage.url(saved_path)

        if upload_for == "teacher":
            if not is_teacher_whitelisted(request.user.email):
                return Response({"detail": "講師でないためアップロードできません。"}, status=status.HTTP_403_FORBIDDEN)
            teacher, _ = models.Teacher.objects.get_or_create(
                email=request.user.email.lower(),
                defaults={
                    "oauth_provider": getattr(request.user, "oauth_provider", "google"),
                    "oauth_sub": getattr(request.user, "oauth_sub", "") + "_teacher",
                },
            )
            profile, _ = models.TeacherProfile.objects.get_or_create(teacher=teacher)
            profile.avatar_url = public_url
            profile.save(update_fields=["avatar_url"])
            return Response({"avatar_url": public_url})

        profile, _ = models.UserProfile.objects.get_or_create(
            user=request.user,
            defaults={"display_name": request.user.email, "avatar_url": public_url},
        )
        profile.avatar_url = public_url
        profile.save(update_fields=["avatar_url"])
        return Response({"avatar_url": public_url})


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

    def _rate_limit(self, key: str, limit: int, window_seconds: int):
        cache = caches["default"]
        current = cache.get(key, 0)
        if current >= limit:
            return False
        cache.set(key, current + 1, timeout=window_seconds)
        return True

    def _generate_unique_code(self, length: int = 8) -> str:
        """他ユーザーと衝突しない招待コードを生成"""
        for _ in range(5):
            code = uuid.uuid4().hex[:length].upper()
            if not models.InvitationCode.objects.filter(invitation_code=code).exists():
                return code
        # 万一衝突が続いた場合は長めに生成して返す
        return uuid.uuid4().hex[:12].upper()

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="issue")
    def issue(self, request):
        """講師が招待コードを発行する"""
        teacher = getattr(request, "teacher", None)
        if teacher is None:
            raise PermissionDenied("講師のみが招待コードを発行できます。")

        # レート制限の簡易チェック: 1分間に50件まで（キャッシュ）
        if not self._rate_limit(f"invite_issue:{teacher.id}", limit=50, window_seconds=60):
            return Response({"detail": "発行上限に達しました。少し待って再試行してください。"}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        expires_in_minutes = int(request.data.get("expires_in_minutes") or 60)
        expires_at = timezone.now() + timezone.timedelta(minutes=expires_in_minutes)

        code = models.InvitationCode.objects.create(
            invitation_code=self._generate_unique_code(),
            issued_by=teacher,
            expires_at=expires_at,
        )
        return Response(serializers.InvitationCodeSerializer(code).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="revoke")
    def revoke(self, request, pk=None):
        """招待コードを失効させる"""
        teacher = getattr(request, "teacher", None)
        if teacher is None:
            raise PermissionDenied("講師のみが失効操作できます。")
        invite = self.get_object()
        if invite.issued_by_id != teacher.id:
            raise PermissionDenied("自分が発行したコードのみ失効できます。")
        invite.revoked = True
        invite.revoked_at = timezone.now()
        invite.save(update_fields=["revoked", "revoked_at"])
        return Response({"detail": "招待コードを失効しました。"})

    def _serialize_teacher_profile(self, teacher):
        profile = getattr(teacher, "profile", None)
        data = {
            "teacher_id": teacher.id,
            "display_name": profile.display_name if profile and profile.display_name else teacher.email,
            "affiliation": profile.affiliation if profile and profile.affiliation else None,
            "avatar_url": profile.avatar_url if profile and profile.avatar_url else None,
            "bio": profile.bio if profile and profile.bio else None,
            "updated_at": profile.updated_at if profile else teacher.updated_at,
        }
        serializer = serializers.StudentTeacherPublicProfileSerializer(data)
        return serializer.data

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="preview")
    def preview(self, request):
        """招待コードの講師情報を確認する"""
        user = request.user
        ip_addr = request.META.get("REMOTE_ADDR", "unknown")
        if not self._rate_limit(f"invite_preview_ip:{ip_addr}", limit=15, window_seconds=300):
            return Response({"detail": "短時間の招待コード試行回数を超えました。しばらくしてから再試行してください。"}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        if not self._rate_limit(f"invite_preview_user:{user.id}", limit=15, window_seconds=600):
            return Response({"detail": "短時間の招待コード試行回数を超えました。しばらくしてから再試行してください。"}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        code_str = (request.data.get("invitation_code") or "").strip()
        if not code_str:
            return Response({"detail": "招待コードを入力してください。"}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        code = models.InvitationCode.objects.filter(
            invitation_code=code_str,
            revoked=False,
        ).select_related("issued_by__profile").first()
        if not code:
            return Response({"detail": "招待コードが無効です。"}, status=status.HTTP_400_BAD_REQUEST)
        if code.expires_at and code.expires_at < now:
            return Response({"detail": "招待コードの有効期限が切れています。"}, status=status.HTTP_400_BAD_REQUEST)
        if code.used_at:
            return Response({"detail": "この招待コードは使用済みです。"}, status=status.HTTP_400_BAD_REQUEST)

        existing_link = models.StudentTeacherLink.objects.filter(
            teacher=code.issued_by,
            student=user,
        ).first()
        existing_status = existing_link.status if existing_link else None
        can_redeem = not (existing_link and existing_link.status in [models.LinkStatus.PENDING, models.LinkStatus.ACTIVE])

        teacher_profile = self._serialize_teacher_profile(code.issued_by)
        return Response(
            {
                "teacher_profile": teacher_profile,
                "existing_link_status": existing_status,
                "can_redeem": can_redeem,
            }
        )

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="redeem")
    def redeem(self, request):
        """生徒が招待コードを利用してリンクを作成する"""
        user = request.user
        # IP とユーザー単位で試行回数を制限
        ip_addr = request.META.get("REMOTE_ADDR", "unknown")
        if not self._rate_limit(f"invite_redeem_ip:{ip_addr}", limit=10, window_seconds=300):
            return Response({"detail": "短時間の招待コード試行回数を超えました。しばらくしてから再試行してください。"}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        if not self._rate_limit(f"invite_redeem_user:{user.id}", limit=10, window_seconds=600):
            return Response({"detail": "短時間の招待コード試行回数を超えました。しばらくしてから再試行してください。"}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        code_str = (request.data.get("invitation_code") or "").strip()
        if not code_str:
            return Response({"detail": "招待コードを入力してください。"}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        code = models.InvitationCode.objects.filter(
            invitation_code=code_str,
            revoked=False,
        ).select_related("issued_by__profile").first()
        if not code:
            return Response({"detail": "招待コードが無効です。"}, status=status.HTTP_400_BAD_REQUEST)
        if code.expires_at and code.expires_at < now:
            return Response({"detail": "招待コードの有効期限が切れています。"}, status=status.HTTP_400_BAD_REQUEST)
        if code.used_at:
            return Response({"detail": "この招待コードは使用済みです。"}, status=status.HTTP_400_BAD_REQUEST)

        existing_link = models.StudentTeacherLink.objects.filter(
            teacher=code.issued_by,
            student=user,
        ).first()
        if existing_link:
            if existing_link.status in [models.LinkStatus.PENDING, models.LinkStatus.ACTIVE]:
                return Response({"detail": "既に招待済みです。", "link_id": str(existing_link.id)}, status=status.HTTP_200_OK)
            # 解除済みのリンクは再利用して pending に戻す
            existing_link.status = models.LinkStatus.PENDING
            existing_link.linked_at = timezone.now()
            existing_link.revoked_at = None
            existing_link.revoked_by_teacher = None
            existing_link.revoked_by_student = None
            existing_link.invitation = code
            existing_link.save(
                update_fields=[
                    "status",
                    "linked_at",
                    "revoked_at",
                    "revoked_by_teacher",
                    "revoked_by_student",
                    "invitation",
                ]
            )
            code.used_by = user
            code.used_at = now
            code.save(update_fields=["used_by", "used_at"])
            return Response({"detail": "承認待ちとして登録しました。", "link_id": str(existing_link.id)}, status=status.HTTP_200_OK)

        models.StudentTeacherLink.objects.create(
            teacher=code.issued_by,
            student=user,
            status=models.LinkStatus.PENDING,
            linked_at=timezone.now(),
            invitation=code,
        )
        code.used_by = user
        code.used_at = now
        code.save(update_fields=["used_by", "used_at"])
        return Response({"detail": "承認待ちとして登録しました。"}, status=status.HTTP_201_CREATED)


class StudentTeacherLinkViewSet(BaseModelViewSet):
    serializer_class = serializers.StudentTeacherLinkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        user = self.request.user
        qs = models.StudentTeacherLink.objects.select_related("teacher", "student").order_by("-linked_at")

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        from .utils import is_teacher_whitelisted
        if is_teacher_whitelisted(user.email):
            return qs.filter(teacher__email__iexact=user.email)
        return qs.filter(Q(student=user) | Q(teacher__email=user.email))

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="approve")
    def approve(self, request, pk=None):
        """講師が pending を active にする"""
        link = self.get_object()
        if getattr(request, "teacher", None) is None or link.teacher_id != request.teacher.id:
            raise PermissionDenied("承認権限がありません。")
        if link.status != models.LinkStatus.PENDING:
            return Response({"detail": "承認対象ではありません。"}, status=status.HTTP_400_BAD_REQUEST)
        link.status = models.LinkStatus.ACTIVE
        link.linked_at = timezone.now()
        link.save(update_fields=["status", "linked_at"])
        return Response(serializers.StudentTeacherLinkSerializer(link).data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="revoke")
    def revoke(self, request, pk=None):
        """講師または生徒がリンク解除する"""
        link = self.get_object()
        user = request.user
        now = timezone.now()
        if getattr(request, "teacher", None) and link.teacher_id == request.teacher.id:
            link.status = models.LinkStatus.REVOKED
            link.revoked_at = now
            link.revoked_by_teacher = request.teacher
            link.save(update_fields=["status", "revoked_at", "revoked_by_teacher"])
            return Response({"detail": "解除しました。"})
        if link.student_id == user.id:
            link.status = models.LinkStatus.REVOKED
            link.revoked_at = now
            link.revoked_by_student = user
            link.save(update_fields=["status", "revoked_at", "revoked_by_student"])
            return Response({"detail": "解除しました。"})
        raise PermissionDenied("解除権限がありません。")

    @action(detail=True, methods=["post", "patch"], permission_classes=[permissions.IsAuthenticated], url_path="alias")
    def set_alias(self, request, pk=None):
        """講師が表示名（custom_display_name）を設定/更新する"""
        link = self.get_object()
        if getattr(request, "teacher", None) is None or link.teacher_id != request.teacher.id:
            raise PermissionDenied("表示名を変更する権限がありません。")
        alias = request.data.get("custom_display_name", "")
        alias_str = str(alias or "").strip()
        link.custom_display_name = alias_str or None
        link.save(update_fields=["custom_display_name", "updated_at"])
        return Response(serializers.StudentTeacherLinkSerializer(link).data)

    @action(detail=True, methods=["get"], permission_classes=[permissions.IsAuthenticated], url_path="teacher-profile")
    def teacher_profile(self, request, pk=None):
        """生徒向けに講師プロフィールを返す"""
        link = self.get_object()
        if link.student_id != request.user.id:
            raise PermissionDenied("閲覧権限がありません。")
        if link.status not in [models.LinkStatus.PENDING, models.LinkStatus.ACTIVE]:
            return Response({"detail": "この講師との紐付けは現在ありません。"}, status=status.HTTP_404_NOT_FOUND)

        profile = getattr(link.teacher, "profile", None)
        data = {
            "teacher_id": link.teacher_id,
            "display_name": (profile.display_name if profile and profile.display_name else "名前未設定"),
            "affiliation": profile.affiliation if profile and profile.affiliation else None,
            "avatar_url": profile.avatar_url if profile and profile.avatar_url else None,
            "bio": profile.bio if profile and profile.bio else None,
            "updated_at": (profile.updated_at if profile else link.teacher.updated_at),
        }
        serializer = serializers.StudentTeacherPublicProfileSerializer(data)
        return Response(serializer.data)

    @action(detail=False, methods=["get", "patch"], permission_classes=[permissions.IsAuthenticated], url_path="by-teacher")
    def list_by_teacher(self, request):
        """講師用: 個人情報をマスクした生徒一覧と属性更新"""
        teacher = getattr(request, "teacher", None)
        if teacher is None:
            # teacher ミドルウェアが未設定でもメール一致で講師レコードを探す
            teacher = models.Teacher.objects.filter(email__iexact=request.user.email).first()
        if teacher is None:
            raise PermissionDenied("講師アカウントが見つかりません。")

        if request.method.lower() == "patch":
            link_id = request.data.get("student_teacher_link_id")
            if not link_id:
                return Response({"detail": "student_teacher_link_id は必須です。"}, status=status.HTTP_400_BAD_REQUEST)
            try:
                link = models.StudentTeacherLink.objects.select_related("student__profile").get(pk=link_id, teacher=teacher)
            except models.StudentTeacherLink.DoesNotExist:
                raise PermissionDenied("対象が見つからないか、権限がありません。")

            fields = ["custom_display_name", "local_student_code", "tags", "private_note", "kana_for_sort", "color"]
            for f in fields:
                if f in request.data:
                    setattr(link, f, request.data.get(f) or None)
            link.save(update_fields=fields + ["updated_at"])
            return Response(serializers.TeacherStudentListSerializer(link).data)

        include_revoked = str(request.query_params.get("include_revoked", "false")).lower() in {"1", "true"}
        qs = (
            models.StudentTeacherLink.objects.select_related("student__profile")
            .filter(teacher=teacher)
            .order_by("-linked_at")
        )
        if not include_revoked:
            qs = qs.exclude(status=models.LinkStatus.REVOKED)
        data = serializers.TeacherStudentListSerializer(qs, many=True).data
        return Response(data)


class RosterFolderViewSet(BaseModelViewSet):
    serializer_class = serializers.RosterFolderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _get_teacher(self, request):
        teacher = getattr(request, "teacher", None)
        if teacher is None:
            teacher = models.Teacher.objects.filter(email__iexact=request.user.email).first()
        if teacher is None:
            raise PermissionDenied("講師アカウントが見つかりません。")
        return teacher

    def get_queryset(self):  # type: ignore[override]
        teacher = self._get_teacher(self.request)
        qs = (
            models.RosterFolder.objects.select_related("owner_teacher", "parent_folder")
            .filter(owner_teacher=teacher)
            .order_by("name")
        )
        include_archived = str(self.request.query_params.get("include_archived", "false")).lower() in {"1", "true"}
        if not include_archived:
            qs = qs.filter(archived_at__isnull=True)
        return qs

    def perform_create(self, serializer):  # type: ignore[override]
        teacher = self._get_teacher(self.request)
        serializer.save(owner_teacher=teacher)

    def perform_update(self, serializer):  # type: ignore[override]
        teacher = self._get_teacher(self.request)
        if serializer.instance.owner_teacher_id != teacher.id:
            raise PermissionDenied("他の講師のグループは更新できません。")
        serializer.save(owner_teacher=teacher)

    def perform_destroy(self, instance):  # type: ignore[override]
        teacher = self._get_teacher(self.request)
        if instance.owner_teacher_id != teacher.id:
            raise PermissionDenied("他の講師のグループは削除できません。")
        instance.delete()


class RosterMembershipViewSet(BaseModelViewSet):
    serializer_class = serializers.RosterMembershipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):  # type: ignore[override]
        ctx = super().get_serializer_context()
        teacher = getattr(self.request, "teacher", None)
        if teacher is None:
            teacher = models.Teacher.objects.filter(email__iexact=self.request.user.email).first()
        ctx["teacher"] = teacher
        return ctx

    def _get_teacher(self, request):
        teacher = getattr(request, "teacher", None)
        if teacher is None:
            teacher = models.Teacher.objects.filter(email__iexact=request.user.email).first()
        if teacher is None:
            raise PermissionDenied("講師アカウントが見つかりません。")
        return teacher

    def get_queryset(self):  # type: ignore[override]
        teacher = self._get_teacher(self.request)
        qs = (
            models.RosterMembership.objects.select_related("roster_folder", "student__profile")
            .prefetch_related(
                Prefetch(
                    "student__teacher_links",
                    queryset=models.StudentTeacherLink.objects.filter(teacher=teacher),
                    to_attr="prefetched_teacher_links",
                )
            )
            .filter(
                roster_folder__owner_teacher=teacher,
                student__teacher_links__teacher=teacher,
                student__teacher_links__status__in=[models.LinkStatus.ACTIVE, models.LinkStatus.PENDING],
            )
            .order_by("-added_at")
        )
        roster_folder_id = self.request.query_params.get("roster_folder") or self.request.query_params.get(
            "roster_folder_id"
        )
        include_removed = str(self.request.query_params.get("include_removed", "false")).lower() in {"1", "true"}
        if roster_folder_id:
            qs = qs.filter(roster_folder_id=roster_folder_id)
        if not include_removed:
            qs = qs.filter(removed_at__isnull=True)
        qs = qs.distinct()
        return qs

    def create(self, request, *args, **kwargs):  # type: ignore[override]
        teacher = self._get_teacher(request)
        folder_id = request.data.get("roster_folder_id") or request.data.get("roster_folder")
        student_link_id = request.data.get("student_teacher_link_id")
        note = request.data.get("note")
        if not folder_id or not student_link_id:
            return Response({"detail": "roster_folder_id と student_teacher_link_id は必須です。"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            folder = models.RosterFolder.objects.get(id=folder_id, owner_teacher=teacher)
        except models.RosterFolder.DoesNotExist:
            raise PermissionDenied("フォルダが見つからないか、権限がありません。")

        try:
            link = (
                models.StudentTeacherLink.objects.select_related("student", "student__profile")
                .get(id=student_link_id, teacher=teacher)
            )
        except models.StudentTeacherLink.DoesNotExist:
            raise PermissionDenied("生徒リンクが見つからないか、権限がありません。")

        if link.status == models.LinkStatus.REVOKED:
            return Response({"detail": "解除済みの生徒は追加できません。"}, status=status.HTTP_400_BAD_REQUEST)

        active = models.RosterMembership.objects.filter(
            roster_folder=folder, student=link.student, removed_at__isnull=True
        ).select_related("student__profile", "roster_folder")
        if active.exists():
            membership = active.first()
            serializer = self.get_serializer(membership)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # 直近削除済みのものがあれば復活、それ以外は作成（ユニーク制約で落ちないよう get_or_create）
        membership = (
            models.RosterMembership.objects.filter(roster_folder=folder, student=link.student)
            .select_related("student__profile", "roster_folder")
            .order_by("-added_at")
            .first()
        )
        if membership and membership.removed_at:
            membership.removed_at = None
            membership.note = note
            membership.added_at = timezone.now()
            membership.save(update_fields=["removed_at", "note", "added_at"])
        else:
            membership, _ = models.RosterMembership.objects.get_or_create(
                roster_folder=folder,
                student=link.student,
                defaults={"note": note},
            )
        try:
            serializer_obj = (
                self.get_queryset()
                .prefetch_related(
                    Prefetch(
                        "student__teacher_links",
                        queryset=models.StudentTeacherLink.objects.filter(teacher=teacher),
                        to_attr="prefetched_teacher_links",
                    )
                )
                .filter(pk=membership.pk)
                .first()
                or membership
            )
            serializer = self.get_serializer(serializer_obj)
            data = serializer.data
        except Exception:
            # シリアライズで例外が出ても登録は成功しているため簡易レスポンスを返す
            data = {
                "roster_membership_id": str(membership.id),
                "roster_folder": str(folder.id),
                "roster_folder_id": str(folder.id),
                "student": str(link.student.id),
                "student_teacher_link_id": str(link.id),
                "note": membership.note,
                "added_at": membership.added_at,
                "removed_at": membership.removed_at,
            }
        return Response(data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):  # type: ignore[override]
        teacher = self._get_teacher(request)
        membership: models.RosterMembership = self.get_object()
        if membership.roster_folder.owner_teacher_id != teacher.id:
            raise PermissionDenied("他の講師のグループは更新できません。")
        note = request.data.get("note")
        if note is not None:
            membership.note = note
            membership.save(update_fields=["note"])
        serializer = self.get_serializer(membership)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):  # type: ignore[override]
        teacher = self._get_teacher(request)
        membership: models.RosterMembership = self.get_object()
        if membership.roster_folder.owner_teacher_id != teacher.id:
            raise PermissionDenied("他の講師のグループは削除できません。")
        if membership.removed_at is None:
            membership.removed_at = timezone.now()
            membership.save(update_fields=["removed_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class TeacherStudentProgressView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _get_teacher(self, request):
        teacher = getattr(request, "teacher", None)
        if teacher is None:
            teacher = models.Teacher.objects.filter(email__iexact=request.user.email).first()
        if teacher is None:
            raise PermissionDenied("講師アカウントが見つかりません。")
        return teacher

    def get(self, request, link_id: uuid.UUID):
        teacher = self._get_teacher(request)
        try:
            link = (
                models.StudentTeacherLink.objects.select_related("student__profile")
                .get(id=link_id, teacher=teacher)
            )
        except models.StudentTeacherLink.DoesNotExist:
            raise PermissionDenied("対象の生徒リンクが見つからないか、権限がありません。")
        if link.status == models.LinkStatus.REVOKED:
            raise PermissionDenied("解除済みの生徒リンクです。")

        student = link.student
        profile = getattr(student, "profile", None)
        today = timezone.localdate()
        from_param = request.query_params.get("from")
        to_param = request.query_params.get("to")
        date_from = parse_date_param(from_param) or (today - timedelta(days=30))
        date_to = parse_date_param(to_param) or today

        daily_qs = models.LearningSummaryDaily.objects.filter(
            user=student,
            activity_date__range=(date_from, date_to),
        )
        aggregates = daily_qs.aggregate(
            correct=Sum("correct_count"),
            incorrect=Sum("incorrect_count"),
            timeout=Sum("timeout_count"),
            time_ms=Sum("total_time_ms"),
        )
        daily_chart = [
            {
                "date": entry.activity_date.isoformat(),
                "correct_count": entry.correct_count,
                "incorrect_count": entry.incorrect_count,
                "timeout_count": entry.timeout_count,
                "total_time_ms": entry.total_time_ms,
            }
            for entry in daily_qs.order_by("activity_date")
        ]
        total_answers = (aggregates["correct"] or 0) + (aggregates["incorrect"] or 0) + (aggregates["timeout"] or 0)
        accuracy = (aggregates["correct"] or 0) / total_answers * 100 if total_answers else 0.0
        avg_time = (aggregates["time_ms"] or 0) / total_answers / 1000 if total_answers else 0.0

        last_activity = (
            models.QuizResult.objects.filter(user=student, completed_at__isnull=False)
            .order_by("-completed_at")
            .values_list("completed_at", flat=True)
            .first()
        )

        # 所属グループ（講師所有のみ）
        groups = list(
            models.RosterMembership.objects.select_related("roster_folder")
            .filter(
                roster_folder__owner_teacher=teacher,
                student=student,
                removed_at__isnull=True,
            )
            .values("roster_folder_id", "roster_folder__name")
        )

        summary = {
            "student_teacher_link_id": str(link.id),
            "display_name": link.custom_display_name or (profile.display_name if profile else ""),
            "status": link.status,
            "avatar_url": profile.avatar_url if profile else "",
            "bio": getattr(profile, "self_intro", "") if profile else "",
            "last_activity": last_activity.isoformat() if last_activity else None,
            "groups": [{"roster_folder_id": str(g["roster_folder_id"]), "name": g["roster_folder__name"]} for g in groups],
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "totals": {
                "answer_count": total_answers,
                "correct_count": aggregates["correct"] or 0,
                "incorrect_count": aggregates["incorrect"] or 0,
                "timeout_count": aggregates["timeout"] or 0,
                "accuracy": accuracy,
                "avg_seconds": avg_time,
            },
            "daily_chart": daily_chart,
        }
        return Response(summary)


class TeacherStudentProgressViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def _get_teacher(self, request):
        teacher = getattr(request, "teacher", None)
        if teacher is None:
            teacher = models.Teacher.objects.filter(email__iexact=request.user.email).first()
        if teacher is None:
            raise PermissionDenied("講師アカウントが見つかりません。")
        return teacher

    def _get_link(self, request, link_id: uuid.UUID) -> models.StudentTeacherLink:
        teacher = self._get_teacher(request)
        try:
            link = (
                models.StudentTeacherLink.objects.select_related("student__profile")
                .get(id=link_id, teacher=teacher, status__in=[models.LinkStatus.ACTIVE, models.LinkStatus.PENDING])
            )
        except models.StudentTeacherLink.DoesNotExist:
            raise PermissionDenied("対象の生徒リンクが見つからないか、権限がありません。")
        return link

    def _date_range(self, request):
        today = timezone.localdate()
        from_param = request.query_params.get("from")
        to_param = request.query_params.get("to")
        date_from = parse_date_param(from_param) or (today - timedelta(days=30))
        date_to = parse_date_param(to_param) or today
        return date_from, date_to

    @action(detail=True, methods=["get"], url_path="summary")
    def summary(self, request, pk=None):
        link = self._get_link(request, pk)
        student = link.student
        profile = getattr(student, "profile", None)
        date_from, date_to = self._date_range(request)

        daily_qs = models.LearningSummaryDaily.objects.filter(
            user=student,
            activity_date__range=(date_from, date_to),
        )
        aggregates = daily_qs.aggregate(
            correct=Sum("correct_count"),
            incorrect=Sum("incorrect_count"),
            timeout=Sum("timeout_count"),
            time_ms=Sum("total_time_ms"),
        )
        daily_chart = [
            {
                "date": entry.activity_date.isoformat(),
                "correct_count": entry.correct_count,
                "incorrect_count": entry.incorrect_count,
                "timeout_count": entry.timeout_count,
                "total_time_ms": entry.total_time_ms,
            }
            for entry in daily_qs.order_by("activity_date")
        ]
        total_answers = (aggregates["correct"] or 0) + (aggregates["incorrect"] or 0) + (aggregates["timeout"] or 0)
        accuracy = (aggregates["correct"] or 0) / total_answers * 100 if total_answers else 0.0
        avg_time = (aggregates["time_ms"] or 0) / total_answers / 1000 if total_answers else 0.0

        last_activity = (
            models.QuizResult.objects.filter(user=student, completed_at__isnull=False)
            .order_by("-completed_at")
            .values_list("completed_at", flat=True)
            .first()
        )

        groups = list(
            models.RosterMembership.objects.select_related("roster_folder")
            .filter(
                roster_folder__owner_teacher=link.teacher,
                student=student,
                removed_at__isnull=True,
            )
            .values("roster_folder_id", "roster_folder__name")
        )

        data = {
            "student_teacher_link_id": str(link.id),
            "display_name": link.custom_display_name or (profile.display_name if profile else ""),
            "status": link.status,
            "avatar_url": profile.avatar_url if profile else "",
            "bio": getattr(profile, "self_intro", "") if profile else "",
            "last_activity": last_activity.isoformat() if last_activity else None,
            "groups": [{"roster_folder_id": str(g["roster_folder_id"]), "name": g["roster_folder__name"]} for g in groups],
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "totals": {
                "answer_count": total_answers,
                "correct_count": aggregates["correct"] or 0,
                "incorrect_count": aggregates["incorrect"] or 0,
                "timeout_count": aggregates["timeout"] or 0,
                "accuracy": accuracy,
                "avg_seconds": avg_time,
            },
            "daily_chart": daily_chart,
        }
        return Response(data)

    @action(detail=True, methods=["get"], url_path="daily-stats")
    def daily_stats(self, request, pk=None):
        link = self._get_link(request, pk)
        student = link.student
        date_from, date_to = self._date_range(request)
        daily_qs = (
            models.LearningSummaryDaily.objects.filter(user=student, activity_date__range=(date_from, date_to))
            .order_by("activity_date")
        )
        data = [
            {
                "date": entry.activity_date.isoformat(),
                "correct_count": entry.correct_count,
                "incorrect_count": entry.incorrect_count,
                "timeout_count": entry.timeout_count,
                "total_time_ms": entry.total_time_ms,
            }
            for entry in daily_qs
        ]
        return Response({"date_from": date_from.isoformat(), "date_to": date_to.isoformat(), "items": data})

    @action(detail=True, methods=["get"], url_path="level-stats")
    def level_stats(self, request, pk=None):
        link = self._get_link(request, pk)
        student = link.student
        date_from, date_to = self._date_range(request)
        level_param = request.query_params.get("level")
        try:
            qs = (
                models.QuizResultDetail.objects.select_related("quiz_result__quiz__quiz_collection")
                .filter(
                    quiz_result__user=student,
                    quiz_result__completed_at__date__gte=date_from,
                    quiz_result__completed_at__date__lte=date_to,
                )
                .annotate(
                    level_code=F("quiz_result__quiz__quiz_collection__level_code"),
                    level_label=F("quiz_result__quiz__quiz_collection__level_label"),
                )
                .exclude(level_code__isnull=True)
            )
            if level_param:
                qs = qs.filter(level_code=level_param)

            level_rows = (
                qs.values("level_code", "level_label")
                .annotate(
                    correct_count=Count("id", filter=Q(is_correct=True, is_timeout=False)),
                    incorrect_count=Count("id", filter=Q(is_correct=False, is_timeout=False)),
                    timeout_count=Count("id", filter=Q(is_timeout=True)),
                )
                .order_by("level_label")
            )
            data = []
            for row in level_rows:
                total = (row["correct_count"] or 0) + (row["incorrect_count"] or 0) + (row["timeout_count"] or 0)
                accuracy = row["correct_count"] / total * 100 if total else 0.0
                data.append(
                    {
                        "level_code": row["level_code"],
                        "level_label": row["level_label"] or row["level_code"],
                        "correct_count": row["correct_count"],
                        "incorrect_count": row["incorrect_count"],
                        "timeout_count": row["timeout_count"],
                        "answer_count": total,
                        "accuracy": accuracy,
                    }
                )
            return Response({"date_from": date_from.isoformat(), "date_to": date_to.isoformat(), "items": data})
        except Exception as exc:  # noqa: BLE001
            return Response({"detail": f"level-stats 集計でエラーが発生しました: {exc}"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"], url_path="sessions")
    def sessions(self, request, pk=None):
        link = self._get_link(request, pk)
        student = link.student
        date_from, date_to = self._date_range(request)
        page_size = int(request.query_params.get("limit", 50))
        page_size = max(1, min(page_size, 200))

        results = (
            models.QuizResult.objects.select_related("quiz__quiz_collection")
            .filter(
                user=student,
                completed_at__isnull=False,
                completed_at__date__gte=date_from,
                completed_at__date__lte=date_to,
            )
            .order_by("-completed_at")[:page_size]
        )
        result_ids = [r.id for r in results]
        detail_agg = (
            models.QuizResultDetail.objects.filter(quiz_result_id__in=result_ids)
            .values("quiz_result_id")
            .annotate(
                correct_count=Count("id", filter=Q(is_correct=True, is_timeout=False)),
                incorrect_count=Count("id", filter=Q(is_correct=False, is_timeout=False)),
                timeout_count=Count("id", filter=Q(is_timeout=True)),
            )
        )
        agg_map = {row["quiz_result_id"]: row for row in detail_agg}
        items = []
        for res in results:
            agg = agg_map.get(res.id, {})
            total = agg.get("correct_count", 0) + agg.get("incorrect_count", 0) + agg.get("timeout_count", 0)
            accuracy = agg.get("correct_count", 0) / total * 100 if total else 0.0
            items.append(
                {
                    "quiz_result_id": str(res.id),
                    "completed_at": res.completed_at.isoformat() if res.completed_at else None,
                    "started_at": res.started_at.isoformat() if res.started_at else None,
                    "quiz_title": res.quiz.title or res.quiz.quiz_collection.title,
                    "level_code": res.quiz.quiz_collection.level_code,
                    "level_label": res.quiz.quiz_collection.level_label,
                    "question_count": res.question_count,
                    "correct_count": agg.get("correct_count", 0),
                    "incorrect_count": agg.get("incorrect_count", 0),
                    "timeout_count": agg.get("timeout_count", 0),
                    "accuracy": accuracy,
                    "total_time_ms": res.total_time_ms,
                }
            )
        return Response({"date_from": date_from.isoformat(), "date_to": date_to.isoformat(), "items": items})

    @action(detail=True, methods=["get"], url_path="weak-words")
    def weak_words(self, request, pk=None):
        link = self._get_link(request, pk)
        student = link.student
        date_from, date_to = self._date_range(request)
        limit_param = request.query_params.get("limit") or "20"
        try:
            limit = max(1, min(int(limit_param), 200))
        except Exception:
            limit = 20

        detail_qs = (
            models.QuizResultDetail.objects.select_related("vocabulary")
            .filter(
                quiz_result__user=student,
                quiz_result__completed_at__date__gte=date_from,
                quiz_result__completed_at__date__lte=date_to,
            )
        )
        agg = (
            detail_qs.values("vocabulary_id", "vocabulary__text_en")
            .annotate(
                correct_count=Count("id", filter=Q(is_correct=True, is_timeout=False)),
                incorrect_count=Count("id", filter=Q(is_correct=False, is_timeout=False)),
                timeout_count=Count("id", filter=Q(is_timeout=True)),
                last_incorrect=Max("created_at", filter=Q(is_correct=False, is_timeout=False)),
            )
            .order_by("-incorrect_count", "-timeout_count", "-last_incorrect")[:limit]
        )
        items = []
        for row in agg:
            total = (row["correct_count"] or 0) + (row["incorrect_count"] or 0) + (row["timeout_count"] or 0)
            accuracy = row["correct_count"] / total * 100 if total else 0.0
            items.append(
                {
                    "vocabulary_id": str(row["vocabulary_id"]),
                    "text_en": row["vocabulary__text_en"],
                    "correct_count": row["correct_count"],
                    "incorrect_count": row["incorrect_count"],
                    "timeout_count": row["timeout_count"],
                    "answer_count": total,
                    "accuracy": accuracy,
                    "last_incorrect_at": row["last_incorrect"].isoformat() if row.get("last_incorrect") else None,
                }
            )
        return Response({"date_from": date_from.isoformat(), "date_to": date_to.isoformat(), "items": items})


class TeacherGroupMemberSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _get_teacher(self, request):
        teacher = getattr(request, "teacher", None)
        if teacher is None:
            teacher = models.Teacher.objects.filter(email__iexact=request.user.email).first()
        if teacher is None:
            raise PermissionDenied("講師アカウントが見つかりません。")
        return teacher

    def get(self, request, folder_id: uuid.UUID):
        teacher = self._get_teacher(request)
        days_param = request.query_params.get("days") or "30"
        try:
            days = max(1, min(int(days_param), 365))
        except Exception:
            days = 30
        date_from = timezone.localdate() - timedelta(days=days - 1)
        date_to = timezone.localdate()

        try:
            folder = models.RosterFolder.objects.get(id=folder_id, owner_teacher=teacher)
        except models.RosterFolder.DoesNotExist:
            raise PermissionDenied("フォルダが見つからないか、権限がありません。")

        memberships = (
            models.RosterMembership.objects.select_related("student__profile")
            .prefetch_related(
                Prefetch(
                    "student__teacher_links",
                    queryset=models.StudentTeacherLink.objects.filter(
                        teacher=teacher, status__in=[models.LinkStatus.ACTIVE, models.LinkStatus.PENDING]
                    ),
                    to_attr="prefetched_teacher_links",
                )
            )
            .filter(roster_folder=folder, removed_at__isnull=True)
        )

        student_ids: list[uuid.UUID] = []
        link_map: dict[uuid.UUID, models.StudentTeacherLink] = {}
        for m in memberships:
            links = getattr(m.student, "prefetched_teacher_links", None) or getattr(m.student, "teacher_links", None)
            link = None
            if links:
                for l in links:
                    if l.teacher_id == teacher.id and l.status != models.LinkStatus.REVOKED:
                        link = l
                        break
            if link:
                student_ids.append(m.student_id)
                link_map[m.student_id] = link

        daily_agg = (
            models.LearningSummaryDaily.objects.filter(user_id__in=student_ids, activity_date__range=(date_from, date_to))
            .values("user_id")
            .annotate(
                correct_count=Sum("correct_count"),
                incorrect_count=Sum("incorrect_count"),
                timeout_count=Sum("timeout_count"),
                total_time_ms=Sum("total_time_ms"),
            )
        )
        daily_map = {row["user_id"]: row for row in daily_agg}

        last_activity_qs = (
            models.QuizResult.objects.filter(user_id__in=student_ids, completed_at__isnull=False)
            .values("user_id")
            .annotate(last_activity=Max("completed_at"))
        )
        last_map = {row["user_id"]: row["last_activity"] for row in last_activity_qs}

        results: list[dict[str, Any]] = []
        for m in memberships:
            link = link_map.get(m.student_id)
            if not link:
                continue
            profile = getattr(m.student, "profile", None)
            agg = daily_map.get(m.student_id, {}) or {}
            total_answers = (agg.get("correct_count") or 0) + (agg.get("incorrect_count") or 0) + (agg.get("timeout_count") or 0)
            accuracy = (agg.get("correct_count") or 0) / total_answers * 100 if total_answers else 0.0
            last_at = last_map.get(m.student_id)

            results.append(
                {
                    "student_teacher_link_id": str(link.id),
                    "display_name": link.custom_display_name or (profile.display_name if profile else ""),
                    "avatar_url": profile.avatar_url if profile else "",
                    "status": link.status,
                    "last_activity_at": last_at.isoformat() if last_at else None,
                    "total_answers": total_answers,
                    "correct_answers": agg.get("correct_count") or 0,
                    "correct_rate": accuracy,
                }
            )

        return Response({"days": days, "items": results})



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
    serializer_class = serializers.QuizCollectionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        qs = (
            models.QuizCollection.objects.select_related("owner_user", "origin_collection")
            .annotate(
                active_quiz_count=Count(
                    "quizzes__questions",
                    filter=Q(quizzes__archived_at__isnull=True, quizzes__questions__archived_at__isnull=True),
                    distinct=True,
                )
            )
            .filter(archived_at__isnull=True)
        )

        scope = self.request.query_params.get("scope")
        if scope:
            qs = qs.filter(scope=scope)

        include_unpublished = str(self.request.query_params.get("include_unpublished", "false")).lower() in {"1", "true"}
        if not include_unpublished:
            qs = qs.filter(is_published=True)

        include_empty = str(self.request.query_params.get("include_empty", "false")).lower() in {"1", "true"}
        if not include_empty:
            qs = qs.filter(active_quiz_count__gt=0)

        return qs.order_by("order_index", "level_order", "title")


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
        return (
            models.QuizResult.objects.select_related("user", "quiz")
            .filter(user=self.request.user, completed_at__isnull=False)
            .filter(Exists(models.QuizResultDetail.objects.filter(quiz_result=OuterRef("pk"))))
            .order_by("-started_at")
        )

    @action(detail=False, methods=["post"], url_path="submit-session", permission_classes=[permissions.IsAuthenticated])
    def submit_session(self, request, *args, **kwargs):
        try:
            qr, details = _submit_quiz_session(request.user, request.data)
        except serializers.ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "quiz_result_id": str(qr.id),
                "quiz_id": str(qr.quiz_id),
                "question_count": qr.question_count,
                "score": qr.score,
                "total_time_ms": qr.total_time_ms,
                "details": details,
            },
            status=status.HTTP_201_CREATED,
        )

    def perform_create(self, serializer):  # type: ignore[override]
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):  # type: ignore[override]
        serializer.save(user=self.request.user)


class QuizResultDetailViewSet(BaseModelViewSet):
    serializer_class = serializers.QuizResultDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        correct_choice_subquery = (
            models.VocabChoice.objects.filter(vocabulary=OuterRef("vocabulary"), is_correct=True)
            .order_by("created_at")
            .values("text_ja")[:1]
        )
        return (
            models.QuizResultDetail.objects.select_related("quiz_result", "vocabulary")
            .annotate(correct_text=Subquery(correct_choice_subquery))
            .filter(quiz_result__user=self.request.user)
            .order_by("question_order")
        )

    def list(self, request, *args, **kwargs):  # type: ignore[override]
        """
        quiz_result を指定された場合は、そのセッションの最新 question_count 件のみを返す。
        過去に同じ quiz_result_id に蓄積された古い明細が混ざっていても、最新分だけに限定する。
        """
        quiz_result_id = request.query_params.get("quiz_result")
        if quiz_result_id:
            try:
                quiz_result = models.QuizResult.objects.get(id=quiz_result_id, user=request.user)
            except models.QuizResult.DoesNotExist:
                return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

            qs = (
                models.QuizResultDetail.objects.select_related("quiz_result", "vocabulary")
                .annotate(
                    correct_text=Subquery(
                        models.VocabChoice.objects.filter(vocabulary=OuterRef("vocabulary"), is_correct=True)
                        .order_by("created_at")
                        .values("text_ja")[:1]
                    )
                )
                .filter(quiz_result=quiz_result)
                .order_by("created_at", "id")
            )
            take = quiz_result.question_count or qs.count()
            latest = list(qs)[-take:]
            latest_sorted = sorted(latest, key=lambda d: d.question_order or 0)
            serializer = self.get_serializer(latest_sorted, many=True)
            return Response(serializer.data)

        return super().list(request, *args, **kwargs)

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
        # 仕様:
        # - 今日解いていない場合: 昨日から遡った連続日数（昨日も解いていなければ 0）
        # - 今日解いている場合: 今日を含めて遡った連続日数
        #   学習日とは、LearningSummaryDaily のいずれかのカウントが正の値の日
        recent_summaries = list(
            models.LearningSummaryDaily.objects.filter(user=user, activity_date__gte=today - timedelta(days=370))
            .values("activity_date", "correct_count", "incorrect_count", "timeout_count", "total_time_ms")
        )
        active_dates = {
            row["activity_date"]
            for row in recent_summaries
            if (row.get("correct_count", 0) or 0)
            + (row.get("incorrect_count", 0) or 0)
            + (row.get("timeout_count", 0) or 0)
            > 0
        }

        # アンカー日（起点）を決定
        if today in active_dates:
            anchor = today
        elif (today - timedelta(days=1)) in active_dates:
            anchor = today - timedelta(days=1)
        else:
            anchor = None

        current_streak = 0
        if anchor is not None:
            d = anchor
            while d in active_dates:
                current_streak += 1
                d = d - timedelta(days=1)

        # 追加デバッグログ（クエリ param `debug_streak=1` もしくは DEBUG のとき）
        try:
            debug_flag = str(request.query_params.get("debug_streak", "0")).lower() in {"1", "true", "yes"}
        except Exception:
            debug_flag = False
        if debug_flag or settings.DEBUG:
            try:
                logger.info(
                    "streak_debug user=%s today=%s tz=%s active_dates=%s anchor=%s current=%s",
                    getattr(user, "id", None),
                    today,
                    getattr(settings, "TIME_ZONE", None),
                    sorted(list(active_dates)),
                    anchor,
                    current_streak,
                )
            except Exception:
                pass
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

        # 日/週/月のチャートデータを構築
        recent_daily = models.LearningSummaryDaily.objects.filter(
            user=user,
            activity_date__gte=today - timedelta(days=370),  # 最大371日分（今日を含む）
        ).order_by("activity_date")
        daily_chart = [
            {
                "date": summary.activity_date.isoformat(),
                "correct_count": summary.correct_count,
                "incorrect_count": summary.incorrect_count,
                "timeout_count": summary.timeout_count,
                "total_time_ms": summary.total_time_ms,
                "mastered_count": 0,  # TODO: mastered 遷移数を計測する場合はここで算出
            }
            for summary in recent_daily
        ]
        max_daily_total = max(
            [
                data["correct_count"] + data["incorrect_count"] + data["timeout_count"]
                for data in daily_chart
            ]
            or [0]
        )

        weekly_chart = []
        weekly_qs = (
            models.LearningSummaryDaily.objects.filter(user=user, activity_date__gte=today - timedelta(days=180))
            .annotate(week=TruncWeek("activity_date"))
            .values("week")
            .annotate(
                correct_count=Sum("correct_count"),
                incorrect_count=Sum("incorrect_count"),
                timeout_count=Sum("timeout_count"),
                total_time_ms=Sum("total_time_ms"),
            )
            .order_by("week")
        )
        for entry in weekly_qs:
            week = entry.get("week")
            if not week:
                continue
            weekly_chart.append(
                {
                    "period": week.isoformat(),
                    "label": week.strftime("%m/%d"),
                    "correct_count": entry.get("correct_count") or 0,
                    "incorrect_count": entry.get("incorrect_count") or 0,
                    "timeout_count": entry.get("timeout_count") or 0,
                    "total_time_ms": entry.get("total_time_ms") or 0,
                    "from_date": week.isoformat(),
                    "to_date": (week + timedelta(days=6)).isoformat(),
                    "mastered_count": 0,
                }
            )
        max_weekly_total = max(
            [
                item["correct_count"] + item["incorrect_count"] + item["timeout_count"]
                for item in weekly_chart
            ]
            or [0]
        )

        monthly_chart = []
        monthly_qs = (
            models.LearningSummaryDaily.objects.filter(user=user, activity_date__gte=today - timedelta(days=365))
            .annotate(month=TruncMonth("activity_date"))
            .values("month")
            .annotate(
                correct_count=Sum("correct_count"),
                incorrect_count=Sum("incorrect_count"),
                timeout_count=Sum("timeout_count"),
                total_time_ms=Sum("total_time_ms"),
            )
            .order_by("month")
        )
        for entry in monthly_qs:
            month = entry.get("month")
            if not month:
                continue
            # 当月の末日を算出
            next_month = month.replace(day=28) + timedelta(days=4)
            month_end = next_month - timedelta(days=next_month.day)
            monthly_chart.append(
                {
                    "period": month.isoformat(),
                    "label": month.strftime("%Y/%m"),
                    "correct_count": entry.get("correct_count") or 0,
                    "incorrect_count": entry.get("incorrect_count") or 0,
                    "timeout_count": entry.get("timeout_count") or 0,
                    "total_time_ms": entry.get("total_time_ms") or 0,
                    "from_date": month.isoformat(),
                    "to_date": month_end.isoformat(),
                    "mastered_count": 0,
                }
            )
        max_monthly_total = max(
            [
                item["correct_count"] + item["incorrect_count"] + item["timeout_count"]
                for item in monthly_chart
            ]
            or [0]
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
                "chart": daily_chart,
                "max_total": max_daily_total,
            },
            "weekly_chart": {"chart": weekly_chart, "max_total": max_weekly_total},
            "monthly_chart": {"chart": monthly_chart, "max_total": max_monthly_total},
            "focus_summary": focus_summary,
            "quiz_result_count": quiz_result_count,
            "test_result_count": test_result_count,
            "pending_tests": pending_tests,
        }
        return Response(summary)


class StudentLearningStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.localdate()

        # 期間指定（デフォルト30日）
        period_param = request.query_params.get("period", "30d")
        period_map = {"7d": 7, "30d": 30, "90d": 90, "all": None}
        period_days = period_map.get(period_param, 30)
        start_date = today - timedelta(days=period_days - 1) if period_days else None

        # LearningSummaryDaily から今日/7日/30日と期間集計
        base_daily_qs = models.LearningSummaryDaily.objects.filter(user=user)

        def sum_range(start: timezone.datetime.date | None, end: timezone.datetime.date):
            qs = base_daily_qs.filter(activity_date__lte=end)
            if start:
                qs = qs.filter(activity_date__gte=start)
            agg = qs.aggregate(
                correct=Sum("correct_count"),
                incorrect=Sum("incorrect_count"),
                timeout=Sum("timeout_count"),
                time_ms=Sum("total_time_ms"),
            )
            return {
                "correct": agg["correct"] or 0,
                "incorrect": agg["incorrect"] or 0,
                "timeout": agg["timeout"] or 0,
                "time_ms": agg["time_ms"] or 0,
            }

        today_summary = sum_range(today, today)
        seven_summary = sum_range(today - timedelta(days=6), today)
        thirty_summary = sum_range(today - timedelta(days=29), today)

        period_summary = sum_range(start_date, today)

        # 期間内の明細（完了セッションのみ）
        detail_qs = models.QuizResultDetail.objects.filter(
            quiz_result__user=user,
            quiz_result__completed_at__isnull=False,
        )
        if start_date:
            detail_qs = detail_qs.filter(quiz_result__completed_at__date__gte=start_date)

        period_answer_count = detail_qs.count()
        period_correct = detail_qs.filter(is_correct=True, is_timeout=False).count()
        period_timeout = detail_qs.filter(is_timeout=True).count()
        period_incorrect = detail_qs.filter(is_correct=False, is_timeout=False).count() + period_timeout
        non_timeout_qs = detail_qs.filter(Q(is_timeout=False) & Q(reaction_time_ms__isnull=False))
        total_reaction_ms = non_timeout_qs.aggregate(total=Sum("reaction_time_ms"))["total"] or 0
        non_timeout_count = non_timeout_qs.count()
        avg_reaction_time_sec = total_reaction_ms / non_timeout_count / 1000 if non_timeout_count else 0.0
        accuracy_rate = period_correct / period_answer_count * 100 if period_answer_count else 0.0

        # よく間違える単語（期間内上位5件） 不正解+Timeoutを降順
        weak_agg = (
            detail_qs.values("vocabulary_id", "vocabulary__text_en")
            .annotate(
                correct_count=Count("id", filter=Q(is_correct=True, is_timeout=False)),
                incorrect_count=Count("id", filter=Q(is_correct=False, is_timeout=False)),
                timeout_count=Count("id", filter=Q(is_timeout=True)),
                wrong_total=Count("id", filter=Q(Q(is_correct=False) | Q(is_timeout=True))),
                total_count=Count("id"),
                last_incorrect=Max("created_at", filter=Q(is_correct=False, is_timeout=False)),
            )
            .order_by("-wrong_total", "-total_count", "-last_incorrect")[:5]
        )
        weak_items = []
        for row in weak_agg:
            total = row["total_count"] or 0
            if total <= 0:
                continue
            accuracy = row["correct_count"] / total * 100 if total else 0.0
            weak_items.append(
                {
                    "vocabulary_id": str(row["vocabulary_id"]),
                    "text_en": row["vocabulary__text_en"],
                    "answer_count": total,
                    "correct_count": row["correct_count"],
                    "incorrect_count": row["incorrect_count"],
                    "timeout_count": row["timeout_count"],
                    "accuracy": accuracy,
                    "last_incorrect_at": row["last_incorrect"].isoformat() if row.get("last_incorrect") else None,
                }
            )

        # 日/週/月チャート（期間に合わせて最大値を制限）
        daily_chart: list[dict[str, Any]] = []
        chart_days = period_days or 180
        chart_days = min(chart_days, 180)
        daily_start = today - timedelta(days=chart_days - 1)
        daily_qs = base_daily_qs.filter(activity_date__gte=daily_start)
        daily_map = {row.activity_date: row for row in daily_qs}
        for offset in range(chart_days):
            d = daily_start + timedelta(days=offset)
            entry = daily_map.get(d)
            daily_chart.append(
                {
                    "date": d.isoformat(),
                    "correct_count": entry.correct_count if entry else 0,
                    "incorrect_count": entry.incorrect_count if entry else 0,
                    "timeout_count": entry.timeout_count if entry else 0,
                    "total_time_ms": entry.total_time_ms if entry else 0,
                }
            )

        weekly_chart: list[dict[str, Any]] = []
        weekly_window_days = period_days or (7 * 26)
        weekly_start = today - timedelta(days=weekly_window_days - 1)
        weekly_qs = (
            base_daily_qs.filter(activity_date__gte=weekly_start)
            .annotate(week=TruncWeek("activity_date"))
            .values("week")
            .annotate(
                correct_count=Sum("correct_count"),
                incorrect_count=Sum("incorrect_count"),
                timeout_count=Sum("timeout_count"),
                total_time_ms=Sum("total_time_ms"),
            )
            .order_by("week")
        )
        for entry in weekly_qs:
            week = entry.get("week")
            if not week:
                continue
            weekly_chart.append(
                {
                    "period": week.isoformat(),
                    "label": week.strftime("%m/%d"),
                    "correct_count": entry.get("correct_count") or 0,
                    "incorrect_count": entry.get("incorrect_count") or 0,
                    "timeout_count": entry.get("timeout_count") or 0,
                    "total_time_ms": entry.get("total_time_ms") or 0,
                    "from_date": week.isoformat(),
                    "to_date": (week + timedelta(days=6)).isoformat(),
                }
            )
        if len(weekly_chart) > 12:
            weekly_chart = weekly_chart[-12:]

        monthly_chart: list[dict[str, Any]] = []
        monthly_window_days = period_days or 365
        monthly_start = today - timedelta(days=monthly_window_days - 1)
        monthly_qs = (
            base_daily_qs.filter(activity_date__gte=monthly_start)
            .annotate(month=TruncMonth("activity_date"))
            .values("month")
            .annotate(
                correct_count=Sum("correct_count"),
                incorrect_count=Sum("incorrect_count"),
                timeout_count=Sum("timeout_count"),
                total_time_ms=Sum("total_time_ms"),
            )
            .order_by("month")
        )
        for entry in monthly_qs:
            month = entry.get("month")
            if not month:
                continue
            next_month = month.replace(day=28) + timedelta(days=4)
            month_end = next_month - timedelta(days=next_month.day)
            monthly_chart.append(
                {
                    "period": month.isoformat(),
                    "label": month.strftime("%Y/%m"),
                    "correct_count": entry.get("correct_count") or 0,
                    "incorrect_count": entry.get("incorrect_count") or 0,
                    "timeout_count": entry.get("timeout_count") or 0,
                    "total_time_ms": entry.get("total_time_ms") or 0,
                    "from_date": month.isoformat(),
                    "to_date": month_end.isoformat(),
                }
            )
        if len(monthly_chart) > 12:
            monthly_chart = monthly_chart[-12:]

        return Response(
            {
                "period": period_param,
                "period_summary": {
                    "answer_count": period_answer_count,
                    "correct": period_correct,
                    "incorrect": period_incorrect,
                    "timeout": period_timeout,
                    "accuracy_rate": accuracy_rate,
                    "avg_reaction_time_sec": avg_reaction_time_sec,
                },
                "today": today_summary,
                "last7days": seven_summary,
                "last30days": thirty_summary,
                "charts": {
                    "daily": daily_chart,
                    "weekly": weekly_chart,
                    "monthly": monthly_chart,
                },
                "top_mistakes": weak_items,
                "weak_words": weak_items,
            }
        )


class FocusQuestionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        status_param = request.query_params.get("status", models.LearningStatus.WEAK)
        limit_param = request.query_params.get("limit", "10")
        supplement = str(request.query_params.get("supplement", "false")).lower() in {"1", "true", "yes"}
        try:
            limit = max(1, min(int(limit_param), 100))
        except (TypeError, ValueError):
            return Response({"detail": "limit は整数で指定してください"}, status=status.HTTP_400_BAD_REQUEST)

        if status_param not in models.LearningStatus.values:
            return Response({"detail": "status が不正です"}, status=status.HTTP_400_BAD_REQUEST)

        vocabulary_ids: list[str] = []
        preview: list[dict[str, Any]] = []
        available_count = 0
        primary_count = 0
        filled_from: list[dict[str, Any]] = []

        # まだ出題していない公開語彙（UNLEARNED候補）
        unlearned_qs = (
            models.Vocabulary.objects.filter(
                visibility=models.VocabVisibility.PUBLIC,
                status=models.VocabStatus.PUBLISHED,
            )
            .exclude(user_statuses__user=user)
            .order_by("sort_key")
        )

        if status_param == models.LearningStatus.UNLEARNED:
            available_count = unlearned_qs.count()
            selected = list(unlearned_qs[:limit])
            vocabulary_ids = [str(vocab.id) for vocab in selected]
            primary_count = len(vocabulary_ids)
            preview = [{"vocabulary_id": str(vocab.id), "text_en": vocab.text_en} for vocab in selected]
        else:
            status_qs = (
                models.UserVocabStatus.objects.filter(user=user, status=status_param)
                .order_by("last_answered_at")
            )
            available_count = status_qs.count()
            selected_ids = list(status_qs.values_list("vocabulary_id", flat=True)[:limit])
            vocabulary_ids = [str(v_id) for v_id in selected_ids]
            primary_count = len(vocabulary_ids)
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

        # 不足があれば補充（別ステータスや未学習語から）
        if supplement and len(vocabulary_ids) < limit:
            fallback_order = [
                models.LearningStatus.WEAK,
                models.LearningStatus.UNLEARNED,
                models.LearningStatus.LEARNING,
                models.LearningStatus.MASTERED,
            ]
            fallback_order = [s for s in fallback_order if s != status_param]
            selected_set = set(vocabulary_ids)
            needed = limit - len(vocabulary_ids)

            for fb_status in fallback_order:
                if needed <= 0:
                    break
                extra_ids: list[str] = []
                if fb_status == models.LearningStatus.UNLEARNED:
                    extra_ids = [
                        str(v_id)
                        for v_id in unlearned_qs.exclude(id__in=selected_set).values_list("id", flat=True)[:needed]
                    ]
                else:
                    extra_ids = [
                        str(v_id)
                        for v_id in models.UserVocabStatus.objects.filter(user=user, status=fb_status)
                        .exclude(vocabulary_id__in=selected_set)
                        .order_by("last_answered_at")
                        .values_list("vocabulary_id", flat=True)[:needed]
                    ]
                if extra_ids:
                    vocabulary_ids.extend(extra_ids)
                    selected_set.update(extra_ids)
                    filled_from.append({"status": fb_status, "count": len(extra_ids)})
                    needed = limit - len(vocabulary_ids)

        # プレビューは最初の5件を表示用に取得
        if not preview:
            preview_vocab = models.Vocabulary.objects.filter(id__in=vocabulary_ids[:5])
            preview_map = {str(vocab.id): vocab for vocab in preview_vocab}
            preview = [
                {"vocabulary_id": vid, "text_en": preview_map.get(vid).text_en if preview_map.get(vid) else None}
                for vid in vocabulary_ids[:5]
            ]

        data = {
            "status": status_param,
            "requested_limit": limit,
            "available_count": available_count,
            "primary_count": primary_count,
            "vocabulary_ids": vocabulary_ids[:limit],
            "preview": preview[:5],
            "filled_from": filled_from,
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

        focus_collection, _ = models.QuizCollection.objects.get_or_create(
            scope=models.QuizScope.CUSTOM,
            owner_user=user,
            title="フォーカス学習",
            defaults={
                "description": "フォーカス学習セッション",
                "is_published": False,
                "order_index": 1000,
            },
        )

        # reuse or create quiz with same set to avoid clutter
        existing_quiz = (
            models.Quiz.objects.filter(
                quiz_collection=focus_collection,
                question_count=len(ordered_vocabs),
                section_label__isnull=True,
            )
            .order_by("created_at")
            .first()
        )

        if existing_quiz:
            quiz = existing_quiz
            quiz.questions.all().delete()
        else:
            max_seq = focus_collection.quizzes.aggregate(max_seq=Max("sequence_no"))["max_seq"] or 0
            quiz = models.Quiz.objects.create(
                quiz_collection=focus_collection,
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


class QuizSessionQuestionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        quiz_id = request.query_params.get("quiz")
        if not quiz_id:
            return Response({"detail": "quiz は必須です"}, status=status.HTTP_400_BAD_REQUEST)

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
            choices_payload = [
                {"vocab_choice_id": str(choice.id), "text_ja": choice.text_ja, "is_correct": choice.is_correct}
                for choice in vocab_choices
            ]
            random.shuffle(choices_payload)
            correct_choice = next((c for c in vocab_choices if c.is_correct), None)
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
                    "choices": choices_payload,
                    "correct_choice_id": str(correct_choice.id) if correct_choice else None,
                }
            )

        timer_seconds = quiz.timer_seconds or 10
        return Response(
            {
                "quiz_id": str(quiz.id),
                "timer_seconds": timer_seconds,
                "questions": question_payloads,
                "question_count": len(question_payloads),
            }
        )


def _submit_quiz_session(user, payload: dict[str, Any]) -> models.QuizResult:
    quiz_id = payload.get("quiz_id") or payload.get("quiz")
    details = payload.get("details") or []

    if not quiz_id:
        raise serializers.ValidationError({"detail": "quiz_id は必須です"})
    if not isinstance(details, list) or len(details) == 0:
        raise serializers.ValidationError({"detail": "details は1件以上の配列で指定してください"})

    quiz = get_object_or_404(models.Quiz.objects.select_related("quiz_collection"), pk=quiz_id, archived_at__isnull=True)

    vocab_ids = [d.get("vocabulary_id") for d in details if d.get("vocabulary_id")]
    vocab_qs = models.Vocabulary.objects.filter(id__in=vocab_ids)
    vocab_map = {str(v.id): v for v in vocab_qs}
    missing = [vid for vid in vocab_ids if vid not in vocab_map]
    if missing:
        raise serializers.ValidationError({"detail": f"存在しない語彙があります: {missing[:3]}..."})

    question_orders = [d.get("question_order") for d in details]
    if any(qo is None for qo in question_orders):
        raise serializers.ValidationError({"detail": "question_order は必須です"})
    if len(set(question_orders)) != len(question_orders):
        raise serializers.ValidationError({"detail": "question_order が重複しています"})

    with transaction.atomic():
        question_count = len(details)
        score = sum(1 for d in details if d.get("is_correct"))
        total_time_ms = sum(int(d.get("reaction_time_ms") or 0) for d in details)

        qr = models.QuizResult.objects.create(
            user=user,
            quiz=quiz,
            started_at=payload.get("started_at") or timezone.now(),
            completed_at=payload.get("completed_at") or timezone.now(),
            question_count=question_count,
            score=score,
            total_time_ms=total_time_ms,
        )

        correct_choices = models.VocabChoice.objects.filter(
            vocabulary_id__in=vocab_ids, is_correct=True
        ).values_list("vocabulary_id", "text_ja")
        correct_choice_map = {str(v_id): text for v_id, text in correct_choices}

        detail_objects = []
        response_details: list[dict[str, Any]] = []
        for d in details:
            vocab_id = d.get("vocabulary_id")
            choice_id = d.get("selected_choice_id") or d.get("choice_id")
            is_correct = bool(d.get("is_correct"))
            if vocab_id and choice_id:
                correct_exists = models.VocabChoice.objects.filter(
                    vocabulary_id=vocab_id, id=choice_id, is_correct=True
                ).exists()
                is_correct = is_correct or correct_exists

            detail_objects.append(
                models.QuizResultDetail(
                    quiz_result=qr,
                    question_order=int(d.get("question_order")),
                    vocabulary_id=vocab_id,
                    selected_text=d.get("selected_text"),
                    is_correct=is_correct,
                    is_timeout=bool(d.get("is_timeout")),
                    reaction_time_ms=d.get("reaction_time_ms"),
                )
            )

        models.QuizResultDetail.objects.bulk_create(detail_objects)

        for obj in detail_objects:
            vocab = vocab_map.get(str(obj.vocabulary_id))
            response_details.append(
                {
                    "quiz_result_detail_id": str(obj.id) if obj.id else None,
                    "question_order": obj.question_order,
                    "vocabulary_id": str(obj.vocabulary_id),
                    "vocab_text_en": vocab.text_en if vocab else None,
                    "selected_text": obj.selected_text,
                    "correct_text": correct_choice_map.get(str(obj.vocabulary_id)),
                    "is_correct": obj.is_correct,
                    "is_timeout": obj.is_timeout,
                    "reaction_time_ms": obj.reaction_time_ms,
                }
            )

        _record_activity_and_statuses(qr)

    return qr, response_details


def _record_activity_and_statuses(quiz_result: models.QuizResult):
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


class QuizSessionStartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        quiz_id = request.data.get("quiz") or request.data.get("quiz_id")
        mode = request.data.get("mode")
        level_id = request.data.get("level_id") or request.data.get("quiz_collection_id")
        count_param = request.data.get("count")

        # ランダム/フォーカス用の即席クイズ生成（quizが無い場合のみ）
        if not quiz_id and mode in {"random", "focus"}:
            # count は指定があればそれを使用、無ければ vocabulary_ids 長から決定
            count_val: int | None = None
            try:
                if count_param is not None:
                    count_val = int(count_param)
            except (TypeError, ValueError):
                return Response({"detail": "count は整数で指定してください"}, status=status.HTTP_400_BAD_REQUEST)

            vocab_ids_payload = request.data.get("vocabulary_ids")
            vocab_ids: list[uuid.UUID] = []
            if isinstance(vocab_ids_payload, list) and vocab_ids_payload:
                for v in vocab_ids_payload:
                    try:
                        vocab_ids.append(uuid.UUID(str(v)))
                    except (TypeError, ValueError):
                        continue

            # count 未指定なら vocabulary_ids ベースで決定
            if count_val is None:
                count_val = len(vocab_ids) if vocab_ids else None
            if count_val is None:
                return Response({"detail": "count は必須です"}, status=status.HTTP_400_BAD_REQUEST)
            if count_val <= 0:
                return Response({"detail": "count は1以上で指定してください"}, status=status.HTTP_400_BAD_REQUEST)
            if not level_id:
                return Response({"detail": "level_id は必須です"}, status=status.HTTP_400_BAD_REQUEST)

            quiz_collection = get_object_or_404(
                models.QuizCollection.objects.filter(archived_at__isnull=True),
                pk=level_id,
            )

            # レベル内の単語プール（QuizQuestion経由で取得）から抽選
            if not vocab_ids:
                vocab_ids = list(
                    models.QuizQuestion.objects.filter(
                        quiz__quiz_collection=quiz_collection,
                        archived_at__isnull=True,
                        quiz__archived_at__isnull=True,
                    )
                    .values_list("vocabulary_id", flat=True)
                    .distinct()
                )
            if not vocab_ids:
                return Response({"detail": "このレベルに出題可能な単語がありません"}, status=status.HTTP_400_BAD_REQUEST)

            # count_val を上限にサンプリング
            if len(vocab_ids) <= count_val:
                selected_vocab_ids = vocab_ids
            else:
                selected_vocab_ids = random.sample(vocab_ids, count_val)

            vocab_items = list(models.Vocabulary.objects.filter(id__in=selected_vocab_ids))
            vocab_map = {str(v.id): v for v in vocab_items}
            ordered_vocabs = [vocab_map[str(v_id)] for v_id in selected_vocab_ids if str(v_id) in vocab_map]

            # 即席Quizを作成（既存スキーマを利用）
            max_seq = quiz_collection.quizzes.aggregate(max_seq=Max("sequence_no"))["max_seq"] or 0
            title_prefix = "[FOCUS]" if mode == "focus" else "[RANDOM]"
            quiz = models.Quiz.objects.create(
                quiz_collection=quiz_collection,
                sequence_no=max_seq + 1,
                title=f"{title_prefix} {quiz_collection.title} ({len(ordered_vocabs)}問)",
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
            quiz_id = str(quiz.id)

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
            _record_activity_and_statuses(quiz_result)

        serializer = serializers.QuizResultSerializer(quiz_result, context={"request": request})
        return Response(serializer.data)

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


# ---------------------------------------------------------------------------
# 学習者用語彙API
# ---------------------------------------------------------------------------


class StudentVocabListView(APIView):
    """
    学習者用語彙一覧API
    
    クエリパラメータ:
    - page: ページ番号（1始まり、デフォルト1）
    - page_size: 1ページあたり件数（デフォルト50、最大100）
    - q: 検索文字列（英単語/日本語訳の部分一致）
    - status: 学習ステータスフィルタ（unlearned/weak/learning/mastered）
    - head: 頭文字フィルタ（a-z）
    - ordering: ソートキー（デフォルトsort_key）
    """
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = PageNumberPagination

    def get(self, request):
        user = request.user
        
        # 基本クエリセット（公開済みの語彙のみ）
        qs = models.Vocabulary.objects.filter(
            visibility=models.VocabVisibility.PUBLIC,
            status=models.VocabStatus.PUBLISHED,
        )

        # 検索
        q = request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(text_en__icontains=q) | Q(translations__text_ja__icontains=q)
            ).distinct()

        # 学習ステータスフィルタ
        status_filter = request.query_params.get("status", "").strip()
        if status_filter and status_filter in [choice[0] for choice in models.LearningStatus.choices]:
            qs = qs.filter(
                user_statuses__user=user,
                user_statuses__status=status_filter,
            )

        # 頭文字フィルタ
        head = request.query_params.get("head", "").strip().lower()
        if head and len(head) == 1 and head.isalpha():
            qs = qs.filter(head_letter=head)

        # ソート
        ordering = request.query_params.get("ordering", "sort_key")
        qs = qs.order_by(ordering)

        # prefetch関連（パフォーマンス最適化）
        qs = qs.prefetch_related(
            Prefetch(
                "translations",
                queryset=models.VocabTranslation.objects.filter(is_primary=True),
                to_attr="primary_translation_list",
            ),
            Prefetch(
                "user_statuses",
                queryset=models.UserVocabStatus.objects.filter(user=user),
                to_attr="user_status_list",
            ),
        )

        # ページング
        paginator = self.pagination_class()
        page_size = request.query_params.get("page_size", "50")
        try:
            page_size_int = int(page_size)
            paginator.page_size = min(max(1, page_size_int), 100)
        except ValueError:
            paginator.page_size = 50

        page = paginator.paginate_queryset(qs, request)
        serializer = serializers.StudentVocabListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class StudentVocabDetailView(APIView):
    """
    学習者用語彙詳細API
    
    パス: /api/student/vocab/<uuid:id>/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, id):
        user = request.user

        # 公開済みの語彙のみ取得
        try:
            vocab = models.Vocabulary.objects.filter(
                visibility=models.VocabVisibility.PUBLIC,
                status=models.VocabStatus.PUBLISHED,
            ).prefetch_related(
                "translations",
                "choices",
                "aliases",
                Prefetch(
                    "user_statuses",
                    queryset=models.UserVocabStatus.objects.filter(user=user),
                    to_attr="user_status_list",
                ),
            ).annotate(
                quiz_question_count=Count("quiz_questions", distinct=True),
                test_question_count=Count("test_questions", distinct=True),
            ).get(pk=id)
        except models.Vocabulary.DoesNotExist:
            return Response(
                {"detail": "指定された語彙が見つかりません。"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = serializers.StudentVocabDetailSerializer(vocab)
        return Response(serializer.data)


class StudentVocabReportView(APIView):
    """
    語彙誤り報告API
    
    パス: POST /api/student/vocab/<uuid:id>/report/
    
    開発者にメール(Gmail)とSlack通知を送信
    """
    permission_classes = [permissions.IsAuthenticated]

    # カテゴリラベル
    MAIN_CATEGORY_LABELS = {
        "translation": "訳の修正",
        "part_of_speech": "品詞の修正",
        "example_sentence": "例文の修正",
        "choice_text": "選択肢テキストの修正",
        "spelling": "スペルの修正",
        "other": "その他",
    }

    DETAIL_CATEGORY_LABELS = {
        "wrong_meaning": "意味が間違っている",
        "missing_sense": "語義が不足している",
        "unnatural_ja": "日本語が不自然",
        "typo": "誤字・脱字",
        "format_issue": "レイアウト・表記の問題",
        "other": "その他",
    }

    def post(self, request, id):
        import json
        import logging
        import requests
        from django.core.mail import send_mail
        from django.core.cache import cache
        from datetime import timedelta

        logger = logging.getLogger(__name__)

        user = request.user
        
        # レート制限チェック（1時間以内100件）
        cache_key = f"vocab_report_count_{user.id}"
        report_count = cache.get(cache_key, 0)
        
        if report_count >= 100:
            return Response(
                {"detail": "報告の送信回数が制限を超えています。しばらく時間をおいてから再度お試しください。"},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # 語彙の存在・公開確認
        vocab = get_object_or_404(
            models.Vocabulary,
            id=id,
            visibility=models.VocabVisibility.PUBLIC,
            status=models.VocabStatus.PUBLISHED,
        )

        # バリデーション
        serializer = serializers.VocabReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        now = timezone.now()
        
        # JSTに変換（UTC+9）
        jst_now = now + timedelta(hours=9)

        main_label = self.MAIN_CATEGORY_LABELS.get(
            data["main_category"], data["main_category"]
        )
        detail_label = self.DETAIL_CATEGORY_LABELS.get(
            data["detail_category"], data["detail_category"]
        )

        # 報告データ構成（最小限の情報のみ）
        report = {
            "user_id": str(user.id),
            "user_email": getattr(user, "email", ""),
            "vocabulary_id": str(vocab.id),
            "vocabulary_text_en": vocab.text_en,
            "reported_text_en": data["reported_text_en"],
            "main_category": data["main_category"],
            "main_category_label": main_label,
            "detail_category": data["detail_category"],
            "detail_category_label": detail_label,
            "detail_text": data["detail_text"],
            "requested_at_jst": jst_now.strftime("%Y-%m-%d %H:%M:%S"),
            "environment": getattr(settings, "ENVIRONMENT", "production"),
        }

        # レート制限カウンタ更新
        cache.set(cache_key, report_count + 1, 3600)  # 1時間有効

        # 1. Gmail送信
        try:
            self._send_gmail(report)
        except Exception:
            logger.exception("Failed to send vocab report email")

        # 2. Slack通知
        try:
            self._send_slack(report)
        except Exception:
            logger.exception("Failed to send vocab report to Slack")

        return Response(
            {"detail": "報告を送信しました。ご協力ありがとうございます。"},
            status=status.HTTP_201_CREATED,
        )

    def _send_gmail(self, report: dict):
        """Gmail送信（最小限の情報のみ）"""
        from django.core.mail import send_mail

        subject = (
            f"[語彙誤り報告] {report['vocabulary_text_en']} / "
            f"{report['main_category_label']}"
        )

        body_lines = [
            "語彙の誤り報告を受け付けました。",
            "",
            "=" * 60,
            "■ 基本情報",
            "=" * 60,
            f"報告受付日時 (JST): {report['requested_at_jst']}",
            f"環境: {report['environment']}",
            "",
            "=" * 60,
            "■ ユーザー情報",
            "=" * 60,
            f"User ID: {report['user_id']}",
            f"メールアドレス: {report['user_email']}",
            "",
            "=" * 60,
            "■ 対象語彙情報",
            "=" * 60,
            f"Vocabulary ID: {report['vocabulary_id']}",
            f"英単語 (DB): {report['vocabulary_text_en']}",
            f"英単語 (ユーザー入力): {report['reported_text_en']}",
            "",
            "※ DBの英単語とユーザー入力が異なる場合はスペルミスなどの可能性があります。",
            "",
            "=" * 60,
            "■ 報告内容",
            "=" * 60,
            f"大分類: {report['main_category_label']} ({report['main_category']})",
            f"小分類: {report['detail_category_label']} ({report['detail_category']})",
            "",
            "詳細コメント:",
            report["detail_text"],
        ]
        body = "\n".join(body_lines)

        email_to = getattr(settings, "VOCAB_REPORT_EMAIL_TO", None)
        if not email_to:
            logger.warning("VOCAB_REPORT_EMAIL_TO is not configured")
            return Response({"detail": "Email reporting is not configured"}, status=500)
        send_mail(
            subject,
            body,
            settings.DEFAULT_FROM_EMAIL,
            [email_to],
            fail_silently=False,
        )

    def _send_slack(self, report: dict):
        """Slack通知（メールアドレスは含めない）"""
        import json
        import requests

        webhook_url = getattr(settings, "VOCAB_REPORT_SLACK_WEBHOOK_URL", None)
        if not webhook_url:
            return  # Slack未設定時はスキップ

        # 詳細コメント抜粋（300文字まで）
        detail_excerpt = report["detail_text"][:300]
        if len(report["detail_text"]) > 300:
            detail_excerpt += "..."

        text_lines = [
            ":incoming_envelope: *語彙誤り報告を受信しました*",
            "",
            f"*単語*: `{report['vocabulary_text_en']}`  (ID: {report['vocabulary_id']})",
            "*報告種別*:",
            f"- 大分類: {report['main_category_label']} ({report['main_category']})",
            f"- 小分類: {report['detail_category_label']} ({report['detail_category']})",
            "",
            "*ユーザー*: ",
                f"- User ID: {report['user_id']}",
            "",
                "*詳細コメント (抜粋)*:",
            detail_excerpt,
            "",
            "*メタ情報*: ",
                f"- 受付日時 (JST): {report['requested_at_jst']}",
            f"- 環境: {report['environment']}",
        ]
        payload = {"text": "\n".join(text_lines)}

        requests.post(webhook_url, data=json.dumps(payload), timeout=5)


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
    "StudentLearningStatusView",
    "StudentVocabListView",
    "StudentVocabDetailView",
    "StudentVocabReportView",
    "UserVocabStatusViewSet",
    "TestViewSet",
    "TestQuestionViewSet",
    "TestAssignmentViewSet",
    "TestAssigneeViewSet",
    "TestResultViewSet",
    "TestResultDetailViewSet",
    "debug_create_user",
    "TeacherStudentProgressViewSet",
    "TeacherGroupMemberSummaryView",
]
