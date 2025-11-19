#!/usr/bin/env python3
"""
英単語マスタJSONLからDB投入＆クイズ自動生成スクリプト

使い方:
    docker compose exec backend python backend/scripts/load_test_data.py

機能:
    1. 単語メインファイル.json (JSONL形式) から語彙データをDBに投入
    2. 重要度順にクイズ構造（レベル・セクション・問題）を自動生成
"""

import os
import sys
import json
from pathlib import Path

# Django設定
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quiz_backend.settings')

import django
django.setup()

from django.utils import timezone
from quiz.models import (
    Vocabulary, VocabTranslation, VocabChoice,
    VocabVisibility, VocabStatus,
    QuizCollection, Quiz, QuizQuestion, QuizScope,
)

# ---------------------------------------------------------------------------
# 定数設定
# ---------------------------------------------------------------------------

ROOT_DIR = Path(__file__).resolve().parents[2]
JSONL_PATH = ROOT_DIR / "単語メインファイル.json"

WORDS_PER_SECTION = 10       # 1セクションの問題数
SECTIONS_PER_LEVEL = 10       # 1レベルあたりのセクション数
RESET_EXISTING_DEFAULT_QUIZZES = False  # True にすると既存デフォルトクイズ削除

# ---------------------------------------------------------------------------
# Step 1: JSONL読み込み（順序維持 & importance抽出）
# ---------------------------------------------------------------------------

def load_jsonl_with_importance():
    """
    JSONLファイルを読み込み、行順を保持しつつimportanceを抽出
    
    戻り値:
        records: [{ "line_no": int, "data": dict, "importance": int }, ...]
        importance_map: { text_en: importance, ... }
    """
    records = []
    importance_map = {}
    
    if not JSONL_PATH.exists():
        print(f"❌ ファイルが見つかりません: {JSONL_PATH}")
        return records, importance_map
    
    print(f"📖 JSONLファイル読み込み中: {JSONL_PATH}")
    
    with open(JSONL_PATH, 'r', encoding='utf-8') as f:
        for line_no, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            
            try:
                data = json.loads(line)
                text_en = data.get('text_en', '').strip()
                
                if not text_en:
                    print(f"⚠️  行 {line_no}: text_en が空です。スキップします。")
                    continue
                
                # importance を取得（デフォルト 0）
                importance = 0
                meta = data.get('meta', {})
                if isinstance(meta, dict):
                    try:
                        importance = int(meta.get('importance', 0))
                    except (ValueError, TypeError):
                        importance = 0
                
                records.append({
                    "line_no": line_no,
                    "data": data,
                    "importance": importance,
                })
                importance_map[text_en] = importance
                
            except json.JSONDecodeError as e:
                print(f"⚠️  行 {line_no}: JSON解析エラー - {e}")
                continue
    
    print(f"✅ {len(records)} 件の単語を読み込みました")
    return records, importance_map

# ---------------------------------------------------------------------------
# Step 2: Vocabulary 等の upsert
# ---------------------------------------------------------------------------

def upsert_vocab_from_records(records):
    """
    records を先頭から順番に処理して Vocabulary/VocabTranslation/VocabChoice を作成・更新
    
    戻り値:
        vocab_list: upsert後の Vocabulary オブジェクトのリスト（順序は JSON行順）
    """
    vocab_list = []
    vocab_id_set = set()  # 重複防止
    
    # 既存の Vocabulary を text_en でマッピング
    existing_vocab_map = {
        v.text_en: v for v in Vocabulary.objects.all()
    }
    
    created_vocab = 0
    updated_vocab = 0
    created_trans = 0
    created_choice = 0
    
    now = timezone.now()
    
    print("\n📝 語彙データをDBに投入中...")
    
    for rec in records:
        data = rec['data']
        line_no = rec['line_no']
        
        text_en = data.get('text_en', '').strip()
        if not text_en:
            continue
        
        # Vocabulary の取得または作成
        vocab = existing_vocab_map.get(text_en)
        if vocab:
            # 既存レコードの更新
            updated = False
            
            # 各フィールドが非空の場合のみ上書き
            if data.get('part_of_speech'):
                vocab.part_of_speech = data['part_of_speech']
                updated = True
            if data.get('explanation'):
                vocab.explanation = data['explanation']
                updated = True
            if data.get('example_en'):
                vocab.example_en = data['example_en']
                updated = True
            if data.get('example_ja'):
                vocab.example_ja = data['example_ja']
                updated = True
            
            # visibility / status / published_at を整合
            if vocab.visibility != VocabVisibility.PUBLIC:
                vocab.visibility = VocabVisibility.PUBLIC
                updated = True
            if vocab.status != VocabStatus.PUBLISHED:
                vocab.status = VocabStatus.PUBLISHED
                updated = True
            if vocab.published_at is None:
                vocab.published_at = now
                updated = True
            
            # sense_count を更新
            translations = data.get('translations', [])
            sense_count = max(1, len(translations))
            if vocab.sense_count != sense_count:
                vocab.sense_count = sense_count
                updated = True
            
            if updated:
                vocab.save()
                updated_vocab += 1
        else:
            # 新規作成
            translations = data.get('translations', [])
            vocab = Vocabulary.objects.create(
                text_en=text_en,
                part_of_speech=data.get('part_of_speech', ''),
                explanation=data.get('explanation', ''),
                example_en=data.get('example_en', ''),
                example_ja=data.get('example_ja', ''),
                sense_count=max(1, len(translations)),
                visibility=VocabVisibility.PUBLIC,
                status=VocabStatus.PUBLISHED,
                published_at=now,
            )
            existing_vocab_map[text_en] = vocab
            created_vocab += 1
        
        # vocab_list に追加（重複防止）
        if vocab.id not in vocab_id_set:
            vocab_list.append(vocab)
            vocab_id_set.add(vocab.id)
        
        # VocabTranslation の処理
        translations = data.get('translations', [])
        for idx, text_ja in enumerate(translations):
            if not text_ja.strip():
                continue
            
            # 既存チェック
            existing_trans = VocabTranslation.objects.filter(
                vocabulary=vocab,
                text_ja=text_ja
            ).first()
            
            if not existing_trans:
                # primary かどうかの判定
                has_primary = VocabTranslation.objects.filter(
                    vocabulary=vocab,
                    is_primary=True
                ).exists()
                
                is_primary = (idx == 0 and not has_primary)
                
                VocabTranslation.objects.create(
                    vocabulary=vocab,
                    text_ja=text_ja,
                    is_primary=is_primary,
                )
                created_trans += 1
            else:
                # 既存レコードがあり、primary が未設定の場合
                if idx == 0 and not existing_trans.is_primary:
                    if not VocabTranslation.objects.filter(vocabulary=vocab, is_primary=True).exists():
                        existing_trans.is_primary = True
                        existing_trans.save()
        
        # VocabChoice の処理
        choices = data.get('choices', {})
        correct_list = choices.get('correct', [])
        dummies_list = choices.get('dummies', [])
        
        for text_ja in correct_list:
            if not text_ja.strip():
                continue
            
            choice, choice_created = VocabChoice.objects.get_or_create(
                vocabulary=vocab,
                text_ja=text_ja,
                defaults={'is_correct': True, 'weight': 1.0}
            )
            if choice_created:
                created_choice += 1
            elif not choice.is_correct:
                choice.is_correct = True
                choice.save()
        
        for text_ja in dummies_list:
            if not text_ja.strip():
                continue
            
            choice, choice_created = VocabChoice.objects.get_or_create(
                vocabulary=vocab,
                text_ja=text_ja,
                defaults={'is_correct': False, 'weight': 0.5}
            )
            if choice_created:
                created_choice += 1
            elif choice.is_correct:
                choice.is_correct = False
                choice.save()
    
    print(f"✅ 語彙投入完了:")
    print(f"   新規作成: {created_vocab} 件")
    print(f"   更新: {updated_vocab} 件")
    print(f"   翻訳作成: {created_trans} 件")
    print(f"   選択肢作成: {created_choice} 件")
    
    return vocab_list

# ---------------------------------------------------------------------------
# Step 3: クイズ構造生成
# ---------------------------------------------------------------------------

def build_quizzes_from_vocab(vocab_list, importance_map):
    """
    vocab_list を importance 順にソートし、クイズ構造を自動生成
    """
    # 既存デフォルトクイズの削除（必要に応じて）
    if RESET_EXISTING_DEFAULT_QUIZZES:
        print("\n🗑️  既存のデフォルトクイズを削除中...")
        QuizQuestion.objects.filter(quiz__quiz_collection__scope=QuizScope.DEFAULT).delete()
        Quiz.objects.filter(quiz_collection__scope=QuizScope.DEFAULT).delete()
        QuizCollection.objects.filter(scope=QuizScope.DEFAULT).delete()
        print("✅ 削除完了")
    
    # importance 降順でソート
    sorted_vocab = sorted(
        vocab_list,
        key=lambda v: (-importance_map.get(v.text_en, 0), v.text_en),
    )
    
    print(f"\n🎯 クイズ構造を生成中（全 {len(sorted_vocab)} 単語）...")
    
    now = timezone.now()
    level_set = set()
    section_set = set()
    question_count = 0
    
    for idx, vocab in enumerate(sorted_vocab):
        # レベル・セクション・問題番号の計算
        level_idx = idx // (WORDS_PER_SECTION * SECTIONS_PER_LEVEL)
        level_no = level_idx + 1

        section_idx = (idx // WORDS_PER_SECTION) % SECTIONS_PER_LEVEL
        section_no = section_idx + 1

        question_order = (idx % WORDS_PER_SECTION) + 1
        
        # QuizCollection (レベル) の取得または作成
        level_code = f"L{level_no}"
        qc, qc_created = QuizCollection.objects.get_or_create(
            scope=QuizScope.DEFAULT,
            level_code=level_code,
            defaults={
                'title': f"レベル{level_no}",
                'description': f"重要度順 英単語レベル{level_no}",
                'level_label': f"レベル{level_no}",
                'level_order': level_no,
                'order_index': level_no,
                'is_published': True,
                'published_at': now,
            }
        )
        level_set.add(level_no)
        
        # Quiz (セクション) の取得または作成
        quiz, quiz_created = Quiz.objects.get_or_create(
            quiz_collection=qc,
            sequence_no=section_no,
            defaults={
                'title': f"セクション{section_no}",
                'section_no': section_no,
                'section_label': f"セクション{section_no}",
                'timer_seconds': 10,
            }
        )
        if not quiz_created:
            updated = False
            desired_title = f"セクション{section_no}"
            desired_label = f"セクション{section_no}"
            if quiz.title != desired_title:
                quiz.title = desired_title
                updated = True
            if quiz.section_label != desired_label:
                quiz.section_label = desired_label
                updated = True
            if quiz.section_no != section_no:
                quiz.section_no = section_no
                updated = True
            if quiz.timer_seconds is None:
                quiz.timer_seconds = 10
                updated = True
            if updated:
                quiz.save(update_fields=["title", "section_label", "section_no", "timer_seconds", "updated_at"])
        section_set.add((level_no, section_no))
        
        # QuizQuestion (問題) の作成または更新
        QuizQuestion.objects.update_or_create(
            quiz=quiz,
            question_order=question_order,
            defaults={
                'vocabulary': vocab,
                'note': '',
            }
        )
        question_count += 1
    
    print(f"✅ クイズ生成完了:")
    print(f"   レベル数: {len(level_set)}")
    print(f"   セクション数: {len(section_set)}")
    print(f"   総問題数: {question_count}")

# ---------------------------------------------------------------------------
# メイン実行関数
# ---------------------------------------------------------------------------

def run():
    """メイン処理"""
    print("=" * 60)
    print("英単語マスタJSONL → DB投入 ＆ クイズ自動生成")
    print("=" * 60)
    
    # Step 1: JSONL読み込み
    records, importance_map = load_jsonl_with_importance()
    if not records:
        print("❌ 読み込むデータがありません。処理を終了します。")
        return
    
    # Step 2: Vocabulary 等の upsert
    vocab_list = upsert_vocab_from_records(records)
    
    # Step 3: クイズ構造生成
    build_quizzes_from_vocab(vocab_list, importance_map)
    
    # 統計情報を表示
    print("\n" + "=" * 60)
    print("📊 最終統計")
    print("=" * 60)
    print(f"Total Vocabularies: {Vocabulary.objects.count()}")
    print(f"Total Translations: {VocabTranslation.objects.count()}")
    print(f"Total Choices: {VocabChoice.objects.count()}")
    print(f"Total QuizCollections: {QuizCollection.objects.count()}")
    print(f"Total Quizzes: {Quiz.objects.count()}")
    print(f"Total QuizQuestions: {QuizQuestion.objects.count()}")
    print("=" * 60)
    print("✨ 処理が完了しました！")

if __name__ == '__main__':
    run()
