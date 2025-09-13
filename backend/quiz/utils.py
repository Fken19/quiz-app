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


def is_teacher_whitelisted(email):
    """講師ホワイトリストチェック（環境変数ベース）"""
    import os
    
    # デフォルトのホワイトリスト（kentaf0926@gmail.com）
    default_whitelist = ['kentaf0926@gmail.com']
    
    # 環境変数からホワイトリストを取得
    whitelist_env = os.environ.get('TEACHER_WHITELIST', '')
    env_emails = [email.strip().lower() for email in whitelist_env.split(',') if email.strip()]
    
    # デフォルトと環境変数のメールアドレスを結合
    whitelist = default_whitelist + env_emails
    whitelist = [email.lower() for email in whitelist]
    
    return email.lower() in whitelist
