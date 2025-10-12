"""ユーティリティ関数"""

from __future__ import annotations

from django.utils import timezone

from .models import TeacherWhitelist


def is_teacher_whitelisted(email: str) -> bool:
    """講師ホワイトリストに存在するか判定"""
    normalized = (email or "").strip().lower()
    if not normalized:
        return False
    now = timezone.now()
    return TeacherWhitelist.objects.filter(
        email__iexact=normalized,
        revoked_at__isnull=True,
        created_at__lte=now,
    ).exists()


__all__ = ["is_teacher_whitelisted"]
