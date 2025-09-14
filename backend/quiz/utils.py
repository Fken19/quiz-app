"""
Quiz app utility functions
"""
import random
import string
from django.utils import timezone
from datetime import timedelta


def generate_invite_code():
    """招待コード生成（ABCD-EF12 形式）"""
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # 紛らわしい文字を除外
    part1 = ''.join(random.choices(chars, k=4))
    part2 = ''.join(random.choices(chars, k=4))
    return f"{part1}-{part2}"


def normalize_invite_code(code):
    """招待コード正規化（大文字・ハイフン付き）"""
    if not code:
        return ''
    normalized = code.upper().strip()
    if len(normalized) == 8 and '-' not in normalized:
        # ハイフンなしの場合は自動挿入
        normalized = f"{normalized[:4]}-{normalized[4:]}"
    return normalized


def get_code_expiry_time(hours=1):
    """コード有効期限を計算"""
    return timezone.now() + timedelta(hours=hours)


def is_teacher_whitelisted(email: str) -> bool:
    """講師ホワイトリストチェック
    優先度: DBのTeacherWhitelist > 環境変数TEACHER_WHITELIST > デフォルト
    """
    if not email:
        return False

    email_l = email.strip().lower()

    # 1) DBベースのホワイトリスト
    try:
        from .models import TeacherWhitelist  # 遅延インポートで循環回避
        if TeacherWhitelist.objects.filter(email__iexact=email_l).exists():
            return True
    except Exception:
        # マイグレーション前やDB未準備のケースは無視してフォールバック
        pass

    # 2) 環境変数ベース（DBにレコードが無い場合のフォールバック）
    import os
    whitelist_env = os.environ.get('TEACHER_WHITELIST', '')
    env_emails = [e.strip().lower() for e in whitelist_env.split(',') if e.strip()]

    # DB に無く、かつ環境変数にもない場合は許可しない
    return email_l in set(env_emails)
