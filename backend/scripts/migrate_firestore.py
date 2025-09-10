"""
Firestore から PostgreSQL への移行スクリプト

使用方法:
    python manage.py shell
    >>> from scripts.migrate_firestore import FirestoreMigrator
    >>> migrator = FirestoreMigrator()
    >>> migrator.migrate_all()
"""

import os
import sys
import django
import hashlib
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Any

# Django settings setup
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quiz_backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from quiz.models import (
    Group, GroupMembership, Question, Option, 
    QuizSession, QuizResult, DailyUserStats, DailyGroupStats
)

User = get_user_model()

try:
    from google.cloud import firestore
    import json
except ImportError:
    print("Google Cloud Firestore ライブラリがインストールされていません。")
    print("pip install google-cloud-firestore")
    sys.exit(1)


class FirestoreMigrator:
    """Firestore から PostgreSQL への移行クラス"""
    
    def __init__(self, firestore_key_path=None):
        """
        Args:
            firestore_key_path: Firestore認証キーのパス（Noneの場合は環境変数から取得）
        """
        if firestore_key_path:
            os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = firestore_key_path
        
        self.db = firestore.Client()
        self.stats = {
            'users': {'processed': 0, 'created': 0, 'updated': 0, 'skipped': 0},
            'groups': {'processed': 0, 'created': 0, 'updated': 0, 'skipped': 0},
            'questions': {'processed': 0, 'created': 0, 'updated': 0, 'skipped': 0},
            'quiz_sessions': {'processed': 0, 'created': 0, 'updated': 0, 'skipped': 0},
            'quiz_results': {'processed': 0, 'created': 0, 'updated': 0, 'skipped': 0},
        }
    
    def generate_deterministic_uuid(self, *args) -> str:
        """決定的なUUIDを生成"""
        content = ''.join(str(arg) for arg in args)
        hash_obj = hashlib.sha256(content.encode())
        return str(uuid.UUID(bytes=hash_obj.digest()[:16], version=4))
    
    def migrate_users(self) -> None:
        """ユーザーデータの移行"""
        print("🔄 ユーザーデータを移行中...")
        
        users_ref = self.db.collection('users')
        
        for doc in users_ref.stream():
            try:
                data = doc.to_dict()
                email = data.get('email', '')
                
                if not email:
                    print(f"⚠️  メールアドレスが空のユーザーをスキップ: {doc.id}")
                    self.stats['users']['skipped'] += 1
                    continue
                
                # 決定的なUUIDを生成
                user_id = self.generate_deterministic_uuid(email)
                
                user, created = User.objects.get_or_create(
                    id=user_id,
                    defaults={
                        'username': email.split('@')[0],  # メールアドレスの@より前
                        'email': email,
                        'display_name': data.get('display_name', ''),
                        'is_staff': data.get('is_admin', False),
                    }
                )
                
                if created:
                    self.stats['users']['created'] += 1
                    print(f"✅ ユーザー作成: {email}")
                else:
                    # 既存ユーザーの更新
                    updated = False
                    if user.display_name != data.get('display_name', ''):
                        user.display_name = data.get('display_name', '')
                        updated = True
                    if user.is_staff != data.get('is_admin', False):
                        user.is_staff = data.get('is_admin', False)
                        updated = True
                    
                    if updated:
                        user.save()
                        self.stats['users']['updated'] += 1
                        print(f"🔄 ユーザー更新: {email}")
                    else:
                        self.stats['users']['skipped'] += 1
                
                self.stats['users']['processed'] += 1
                
            except Exception as e:
                print(f"❌ ユーザー移行エラー {doc.id}: {str(e)}")
                self.stats['users']['skipped'] += 1
    
    def migrate_groups(self) -> None:
        """グループデータの移行"""
        print("🔄 グループデータを移行中...")
        
        groups_ref = self.db.collection('groups')
        
        for doc in groups_ref.stream():
            try:
                data = doc.to_dict()
                name = data.get('name', '')
                owner_email = data.get('owner_email', '')
                
                if not name or not owner_email:
                    print(f"⚠️  必須フィールドが空のグループをスキップ: {doc.id}")
                    self.stats['groups']['skipped'] += 1
                    continue
                
                # オーナーユーザーを検索
                try:
                    owner_user = User.objects.get(email=owner_email)
                except User.DoesNotExist:
                    print(f"⚠️  オーナーユーザーが見つからないグループをスキップ: {name} (owner: {owner_email})")
                    self.stats['groups']['skipped'] += 1
                    continue
                
                # 決定的なUUIDを生成
                group_id = self.generate_deterministic_uuid(name, owner_email)
                
                group, created = Group.objects.get_or_create(
                    id=group_id,
                    defaults={
                        'name': name,
                        'owner_admin': owner_user,
                    }
                )
                
                if created:
                    self.stats['groups']['created'] += 1
                    print(f"✅ グループ作成: {name}")
                else:
                    self.stats['groups']['skipped'] += 1
                
                self.stats['groups']['processed'] += 1
                
            except Exception as e:
                print(f"❌ グループ移行エラー {doc.id}: {str(e)}")
                self.stats['groups']['skipped'] += 1
    
    def migrate_questions_from_jsonl(self, jsonl_path: str = None) -> None:
        """JSONLファイルから問題データを移行"""
        if not jsonl_path:
            # デフォルトパスを設定
            jsonl_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                'data.jsonl'
            )
        
        if not os.path.exists(jsonl_path):
            print(f"⚠️  JSONLファイルが見つかりません: {jsonl_path}")
            return
        
        print(f"🔄 問題データを移行中... ({jsonl_path})")
        
        with open(jsonl_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                try:
                    data = json.loads(line.strip())
                    
                    english = data.get('english', '')
                    japanese = data.get('japanese', '')
                    level = data.get('level', 'basic')
                    segment = data.get('segment', 'A')
                    choices = data.get('choices', [])
                    
                    if not english or not japanese or not choices:
                        print(f"⚠️  必須フィールドが空の問題をスキップ (行 {line_num})")
                        self.stats['questions']['skipped'] += 1
                        continue
                    
                    # 決定的なUUIDを生成
                    question_id = self.generate_deterministic_uuid(english, level, segment)
                    
                    question, created = Question.objects.get_or_create(
                        id=question_id,
                        defaults={
                            'text': english,
                            'level': level,
                            'segment': segment,
                        }
                    )
                    
                    if created:
                        self.stats['questions']['created'] += 1
                        print(f"✅ 問題作成: {english}")
                        
                        # 選択肢を作成
                        for i, choice in enumerate(choices):
                            is_correct = (choice == japanese)
                            option_id = self.generate_deterministic_uuid(english, choice, i)
                            
                            Option.objects.get_or_create(
                                id=option_id,
                                question=question,
                                defaults={
                                    'text': choice,
                                    'is_correct': is_correct,
                                }
                            )
                    else:
                        self.stats['questions']['skipped'] += 1
                    
                    self.stats['questions']['processed'] += 1
                    
                except json.JSONDecodeError as e:
                    print(f"❌ JSON解析エラー (行 {line_num}): {str(e)}")
                    self.stats['questions']['skipped'] += 1
                except Exception as e:
                    print(f"❌ 問題移行エラー (行 {line_num}): {str(e)}")
                    self.stats['questions']['skipped'] += 1
    
    def migrate_quiz_sessions(self) -> None:
        """クイズセッションデータの移行"""
        print("🔄 クイズセッションデータを移行中...")
        
        sessions_ref = self.db.collection('quiz_sessions')
        
        for doc in sessions_ref.stream():
            try:
                data = doc.to_dict()
                user_email = data.get('user_email', '')
                started_at = data.get('started_at')
                
                if not user_email or not started_at:
                    print(f"⚠️  必須フィールドが空のセッションをスキップ: {doc.id}")
                    self.stats['quiz_sessions']['skipped'] += 1
                    continue
                
                # ユーザーを検索
                try:
                    user = User.objects.get(email=user_email)
                except User.DoesNotExist:
                    print(f"⚠️  ユーザーが見つからないセッションをスキップ: {user_email}")
                    self.stats['quiz_sessions']['skipped'] += 1
                    continue
                
                # 決定的なUUIDを生成
                session_id = self.generate_deterministic_uuid(
                    user_email, 
                    started_at.isoformat() if hasattr(started_at, 'isoformat') else str(started_at)
                )
                
                # タイムスタンプ変換
                if hasattr(started_at, 'timestamp'):
                    started_at_dt = datetime.fromtimestamp(started_at.timestamp(), tz=timezone.utc)
                else:
                    started_at_dt = started_at
                
                completed_at_dt = None
                if data.get('completed_at'):
                    completed_at = data.get('completed_at')
                    if hasattr(completed_at, 'timestamp'):
                        completed_at_dt = datetime.fromtimestamp(completed_at.timestamp(), tz=timezone.utc)
                    else:
                        completed_at_dt = completed_at
                
                session, created = QuizSession.objects.get_or_create(
                    id=session_id,
                    defaults={
                        'user': user,
                        'started_at': started_at_dt,
                        'completed_at': completed_at_dt,
                        'total_time_ms': data.get('total_time_ms'),
                    }
                )
                
                if created:
                    self.stats['quiz_sessions']['created'] += 1
                    print(f"✅ セッション作成: {user_email} - {started_at_dt}")
                else:
                    self.stats['quiz_sessions']['skipped'] += 1
                
                self.stats['quiz_sessions']['processed'] += 1
                
            except Exception as e:
                print(f"❌ セッション移行エラー {doc.id}: {str(e)}")
                self.stats['quiz_sessions']['skipped'] += 1
    
    def migrate_quiz_results(self) -> None:
        """クイズ結果データの移行"""
        print("🔄 クイズ結果データを移行中...")
        
        results_ref = self.db.collection('quiz_results')
        
        for doc in results_ref.stream():
            try:
                data = doc.to_dict()
                session_id = data.get('session_id', '')
                question_text = data.get('question', '')
                chosen_answer = data.get('chosen_answer', '')
                is_correct = data.get('is_correct', False)
                
                if not session_id or not question_text:
                    print(f"⚠️  必須フィールドが空の結果をスキップ: {doc.id}")
                    self.stats['quiz_results']['skipped'] += 1
                    continue
                
                # セッションを検索（Firestoreのsession_idからDjangoのセッションを見つける）
                # これは実装依存のため、適切なマッピングロジックが必要
                
                self.stats['quiz_results']['processed'] += 1
                # 実装継続...
                
            except Exception as e:
                print(f"❌ 結果移行エラー {doc.id}: {str(e)}")
                self.stats['quiz_results']['skipped'] += 1
    
    def print_stats(self) -> None:
        """移行統計を表示"""
        print("\n" + "="*50)
        print("📊 移行統計")
        print("="*50)
        
        for collection, stats in self.stats.items():
            print(f"\n【{collection}】")
            print(f"  処理済み: {stats['processed']}")
            print(f"  作成: {stats['created']}")
            print(f"  更新: {stats['updated']}")
            print(f"  スキップ: {stats['skipped']}")
    
    def migrate_all(self, firestore_key_path=None, jsonl_path=None) -> None:
        """全データの移行を実行"""
        print("🚀 Firestore → PostgreSQL 移行を開始...")
        
        try:
            # 1. ユーザー
            self.migrate_users()
            
            # 2. グループ
            self.migrate_groups()
            
            # 3. 問題（JSONLファイルから）
            self.migrate_questions_from_jsonl(jsonl_path)
            
            # 4. クイズセッション
            self.migrate_quiz_sessions()
            
            # 5. クイズ結果
            # self.migrate_quiz_results()  # 実装完了後に有効化
            
            self.print_stats()
            print("\n✅ 移行完了!")
            
        except Exception as e:
            print(f"\n❌ 移行中にエラーが発生しました: {str(e)}")
            self.print_stats()


if __name__ == "__main__":
    # スクリプト直接実行時の処理
    import argparse
    
    parser = argparse.ArgumentParser(description='Firestore to PostgreSQL migration')
    parser.add_argument('--firestore-key', help='Path to Firestore service account key')
    parser.add_argument('--jsonl-path', help='Path to questions JSONL file')
    
    args = parser.parse_args()
    
    migrator = FirestoreMigrator(args.firestore_key)
    migrator.migrate_all(args.firestore_key, args.jsonl_path)
