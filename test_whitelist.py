#!/usr/bin/env python3
"""
ホワイトリスト機能のテスト用スクリプト
"""

import sys
import os

# プロジェクトのルートディレクトリをPythonパスに追加
sys.path.append('/Users/ken/quiz-app/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quiz_backend.settings')

def test_whitelist_function():
    """ホワイトリスト関数をテスト"""
    try:
        from quiz.utils import is_teacher_whitelisted
        
        # テストケース
        test_emails = [
            'kentaf0926@gmail.com',
            'KENTAF0926@GMAIL.COM',  # 大文字小文字のテスト
            'other@example.com',
            '',
            None
        ]
        
        print("=== ホワイトリスト機能テスト ===")
        for email in test_emails:
            result = is_teacher_whitelisted(email)
            print(f"Email: {email} -> Whitelisted: {result}")
            
        return True
    except Exception as e:
        print(f"Error testing whitelist function: {e}")
        return False

def test_env_variables():
    """環境変数をテスト"""
    print("\n=== 環境変数チェック ===")
    teacher_whitelist = os.environ.get('TEACHER_WHITELIST', '')
    print(f"TEACHER_WHITELIST: '{teacher_whitelist}'")
    
    if teacher_whitelist:
        whitelist = [email.strip().lower() for email in teacher_whitelist.split(',')]
        print(f"Parsed whitelist: {whitelist}")
    else:
        print("TEACHER_WHITELIST is not set or empty")

if __name__ == '__main__':
    test_env_variables()
    test_whitelist_function()
