#!/usr/bin/env python3
"""
テストデータ投入スクリプト
提供されたサンプル単語データをデータベースに投入します
"""

import os
import sys
import django
import json

# Django設定
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quiz_backend.settings')
django.setup()

from quiz.models import User, Word, WordTranslation, QuizSet, QuizItem

def load_test_data():
    """テストデータを投入"""
    
    # テストデータ
    test_words = [
        {
            "text": "apple",
            "pos": "noun",
            "primary_translation": "りんご",
            "dummy_translations": ["バナナ", "オレンジ", "ぶどう"],
            "level": 1,
            "segment": 1,
            "grade": "J1",
            "textbook_scopes": [
                { "series": "New Horizon", "edition": "2024", "unit": "Unit 1", "range_note": "pp.10-15" }
            ],
            "explanation": "名詞。果物のりんごを表す基本語。",
            "example_sentences": [
                { "en": "I eat an apple every morning.", "ja": "私は毎朝りんごを食べます。", "source": "自作" }
            ]
        },
        {
            "text": "book",
            "pos": "noun",
            "primary_translation": "本",
            "dummy_translations": ["ペン", "ノート", "机"],
            "level": 1,
            "segment": 1,
            "grade": "J1",
            "textbook_scopes": [
                { "series": "Sunshine", "edition": "2024", "unit": "Unit 1", "range_note": "pp.12-17" }
            ],
            "explanation": "名詞。読むための冊子・書籍。",
            "example_sentences": [
                { "en": "I read a book at home.", "ja": "私は家で本を読みます。", "source": "自作" }
            ]
        },
        {
            "text": "dog",
            "pos": "noun",
            "primary_translation": "犬",
            "dummy_translations": ["猫", "鳥", "魚"],
            "level": 1,
            "segment": 1,
            "grade": "J1",
            "textbook_scopes": [
                { "series": "New Crown", "edition": "2025", "unit": "Unit 1", "range_note": "pp.6-11" }
            ],
            "explanation": "名詞。身近な動物の一種。",
            "example_sentences": [
                { "en": "The dog is very friendly.", "ja": "その犬はとても人なつこい。", "source": "自作" }
            ]
        },
        {
            "text": "water",
            "pos": "noun",
            "primary_translation": "水",
            "dummy_translations": ["牛乳", "ジュース", "お茶"],
            "level": 1,
            "segment": 1,
            "grade": "J1",
            "textbook_scopes": [
                { "series": "One World", "edition": "2025", "unit": "Unit 1", "range_note": "pp.8-13" }
            ],
            "explanation": "名詞。飲用や生活に不可欠な液体。",
            "example_sentences": [
                { "en": "Please drink water.", "ja": "水を飲んでください。", "source": "自作" }
            ]
        },
        {
            "text": "school",
            "pos": "noun",
            "primary_translation": "学校",
            "dummy_translations": ["病院", "公園", "駅"],
            "level": 1,
            "segment": 1,
            "grade": "J1",
            "textbook_scopes": [
                { "series": "Total English", "edition": "2024", "unit": "Unit 2", "range_note": "pp.16-21" }
            ],
            "explanation": "名詞。学ぶための施設や組織。",
            "example_sentences": [
                { "en": "I go to school every day.", "ja": "私は毎日学校に行きます。", "source": "自作" }
            ]
        },
        {
            "text": "chair",
            "pos": "noun",
            "primary_translation": "いす",
            "dummy_translations": ["机", "窓", "ドア"],
            "level": 1,
            "segment": 1,
            "grade": "J1",
            "textbook_scopes": [
                { "series": "New Horizon", "edition": "2025", "unit": "Unit 1", "range_note": "pp.18-23" }
            ],
            "explanation": "名詞。座るための家具。",
            "example_sentences": [
                { "en": "This chair is new.", "ja": "このいすは新しい。", "source": "自作" }
            ]
        },
        {
            "text": "morning",
            "pos": "noun",
            "primary_translation": "朝",
            "dummy_translations": ["夜", "午後", "夕方"],
            "level": 1,
            "segment": 1,
            "grade": "J1",
            "textbook_scopes": [
                { "series": "Sunshine", "edition": "2025", "unit": "Unit 1", "range_note": "pp.10-14" }
            ],
            "explanation": "名詞。日の出から昼頃までの時間帯。",
            "example_sentences": [
                { "en": "I get up early in the morning.", "ja": "私は朝早く起きます。", "source": "自作" }
            ]
        },
        {
            "text": "big",
            "pos": "adj",
            "primary_translation": "大きい",
            "dummy_translations": ["小さい", "速い", "遅い"],
            "level": 1,
            "segment": 1,
            "grade": "J1",
            "textbook_scopes": [
                { "series": "New Crown", "edition": "2024", "unit": "Unit 2", "range_note": "pp.20-25" }
            ],
            "explanation": "形容詞。「大きい」の意味。",
            "example_sentences": [
                { "en": "This box is big.", "ja": "この箱は大きい。", "source": "自作" }
            ]
        },
        {
            "text": "run",
            "pos": "verb",
            "primary_translation": "走る",
            "dummy_translations": ["歩く", "飛ぶ", "泳ぐ"],
            "level": 1,
            "segment": 1,
            "grade": "J1",
            "textbook_scopes": [
                { "series": "One World", "edition": "2024", "unit": "Unit 2", "range_note": "pp.24-29" }
            ],
            "explanation": "動詞。「走る」の意味で日常的に用いる。",
            "example_sentences": [
                { "en": "He runs fast.", "ja": "彼は速く走る。", "source": "自作" }
            ]
        },
        {
            "text": "eat",
            "pos": "verb",
            "primary_translation": "食べる",
            "dummy_translations": ["飲む", "読む", "書く"],
            "level": 1,
            "segment": 1,
            "grade": "J1",
            "textbook_scopes": [
                { "series": "Total English", "edition": "2025", "unit": "Unit 1", "range_note": "pp.8-13" }
            ],
            "explanation": "動詞。食物を口に入れて摂取する。",
            "example_sentences": [
                { "en": "We eat lunch at noon.", "ja": "私たちは正午に昼食を食べます。", "source": "自作" }
            ]
        },
        {
            "text": "train",
            "pos": "noun",
            "primary_translation": "電車",
            "dummy_translations": ["バス", "自転車", "飛行機"],
            "level": 2,
            "segment": 2,
            "grade": "J1",
            "textbook_scopes": [
                { "series": "New Horizon", "edition": "2024", "unit": "Unit 3", "range_note": "pp.26-31" }
            ],
            "explanation": "名詞。レール上を走る公共交通機関。",
            "example_sentences": [
                { "en": "I go to school by train.", "ja": "私は電車で学校に行きます。", "source": "自作" }
            ]
        },
        {
            "text": "city",
            "pos": "noun",
            "primary_translation": "都市",
            "dummy_translations": ["村", "川", "山"],
            "level": 2,
            "segment": 2,
            "grade": "J1",
            "textbook_scopes": [
                { "series": "Sunshine", "edition": "2024", "unit": "Unit 4", "range_note": "pp.30-35" }
            ],
            "explanation": "名詞。人口が多く発達した地域。",
            "example_sentences": [
                { "en": "Tokyo is a big city.", "ja": "東京は大きな都市です。", "source": "自作" }
            ]
        },
        {
            "text": "family",
            "pos": "noun",
            "primary_translation": "家族",
            "dummy_translations": ["友だち", "先生", "生徒"],
            "level": 2,
            "segment": 2,
            "grade": "J1",
            "textbook_scopes": [
                { "series": "New Crown", "edition": "2025", "unit": "Unit 3", "range_note": "pp.22-27" }
            ],
            "explanation": "名詞。親子・兄弟などの集まり。",
            "example_sentences": [
                { "en": "My family is small.", "ja": "私の家族は小さいです。", "source": "自作" }
            ]
        },
        {
            "text": "teacher",
            "pos": "noun",
            "primary_translation": "先生",
            "dummy_translations": ["生徒", "家族", "友だち"],
            "level": 2,
            "segment": 2,
            "grade": "J1",
            "textbook_scopes": [
                { "series": "One World", "edition": "2025", "unit": "Unit 2", "range_note": "pp.18-23" }
            ],
            "explanation": "名詞。教えることを職業とする人。",
            "example_sentences": [
                { "en": "Our teacher is kind.", "ja": "私たちの先生は親切です。", "source": "自作" }
            ]
        },
        {
            "text": "happy",
            "pos": "adj",
            "primary_translation": "うれしい",
            "dummy_translations": ["悲しい", "怒っている", "忙しい"],
            "level": 2,
            "segment": 2,
            "grade": "J1",
            "textbook_scopes": [
                { "series": "Total English", "edition": "2024", "unit": "Unit 3", "range_note": "pp.26-30" }
            ],
            "explanation": "形容詞。気持ちが満たされた状態。",
            "example_sentences": [
                { "en": "I am happy today.", "ja": "私は今日はうれしい。", "source": "自作" }
            ]
        },
        {
            "text": "cold",
            "pos": "adj",
            "primary_translation": "寒い",
            "dummy_translations": ["暑い", "暖かい", "涼しい"],
            "level": 2,
            "segment": 2,
            "grade": "J1",
            "textbook_scopes": [
                { "series": "New Horizon", "edition": "2025", "unit": "Unit 4", "range_note": "pp.28-33" }
            ],
            "explanation": "形容詞。気温が低いことを表す。",
            "example_sentences": [
                { "en": "It is cold in winter.", "ja": "冬は寒い。", "source": "自作" }
            ]
        },
        {
            "text": "write",
            "pos": "verb",
            "primary_translation": "書く",
            "dummy_translations": ["読む", "話す", "見る"],
            "level": 2,
            "segment": 2,
            "grade": "J1",
            "textbook_scopes": [
                { "series": "Sunshine", "edition": "2025", "unit": "Unit 2", "range_note": "pp.20-25" }
            ],
            "explanation": "動詞。文字や文を記す。",
            "example_sentences": [
                { "en": "I write a diary every night.", "ja": "私は毎晩日記を書きます。", "source": "自作" }
            ]
        },
        {
            "text": "open",
            "pos": "verb",
            "primary_translation": "開ける",
            "dummy_translations": ["閉める", "押す", "置く"],
            "level": 2,
            "segment": 2,
            "grade": "J1",
            "textbook_scopes": [
                { "series": "One World", "edition": "2024", "unit": "Unit 3", "range_note": "pp.24-29" }
            ],
            "explanation": "動詞。ドアや窓などを開ける。",
            "example_sentences": [
                { "en": "Please open the door.", "ja": "ドアを開けてください。", "source": "自作" }
            ]
        },
        {
            "text": "music",
            "pos": "noun",
            "primary_translation": "音楽",
            "dummy_translations": ["映画", "ゲーム", "本"],
            "level": 2,
            "segment": 2,
            "grade": "J1",
            "textbook_scopes": [
                { "series": "New Crown", "edition": "2024", "unit": "Unit 4", "range_note": "pp.30-36" }
            ],
            "explanation": "名詞。歌や演奏などの芸術。",
            "example_sentences": [
                { "en": "I like music very much.", "ja": "私は音楽がとても好きです。", "source": "自作" }
            ]
        },
        {
            "text": "lunch",
            "pos": "noun",
            "primary_translation": "昼食",
            "dummy_translations": ["朝食", "夕食", "おやつ"],
            "level": 2,
            "segment": 2,
            "grade": "J1",
            "textbook_scopes": [
                { "series": "Total English", "edition": "2025", "unit": "Unit 2", "range_note": "pp.18-22" }
            ],
            "explanation": "名詞。正午ごろに食べる食事。",
            "example_sentences": [
                { "en": "We have lunch at twelve.", "ja": "私たちは12時に昼食をとります。", "source": "自作" }
            ]
        }
    ]
    
    print("Starting data loading...")
    
    # 開発ユーザーを取得
    try:
        user = User.objects.get(email='dev@example.com')
        print(f"Found user: {user.email}")
    except User.DoesNotExist:
        print("Creating dev user...")
        user = User.objects.create_user(
            username='dev',
            email='dev@example.com',
            password='dev123',
            display_name='Dev User'
        )
    
    # 単語とその翻訳を作成
    words_created = 0
    for word_data in test_words:
        try:
            # Wordオブジェクトを作成（gradeフィールドに対応）
            word, created = Word.objects.get_or_create(
                text=word_data['text'],
                pos=word_data['pos'],
                defaults={
                    'grade': word_data['level'],  # levelをgradeにマッピング
                    'frequency': 100
                }
            )
            
            if created:
                words_created += 1
                print(f"Created word: {word.text}")
                
                # 正解の翻訳を作成
                WordTranslation.objects.create(
                    word=word,
                    text=word_data['primary_translation'],
                    is_correct=True
                )
                
                # ダミー選択肢を作成
                for dummy in word_data['dummy_translations']:
                    WordTranslation.objects.create(
                        word=word,
                        text=dummy,
                        is_correct=False
                    )
                    
        except Exception as e:
            print(f"Error creating word {word_data['text']}: {e}")
    
    print(f"Created {words_created} words")
    
    # テスト用のQuizSetを作成
    try:
        quiz_set = QuizSet.objects.create(
            user=user,
            name="テスト用クイズセット Level 1",
            grade=1,
            total_questions=10,
            pos_filter={}  # 空のJSONオブジェクトを設定
        )
        print(f"Created quiz set: {quiz_set.name}")
        
        # Level 1の単語でQuizItemを作成
        level1_words = Word.objects.filter(grade=1)[:10]
        for i, word in enumerate(level1_words, 1):
            quiz_item = QuizItem.objects.create(
                quiz_set=quiz_set,
                word=word,
                question_number=i,
                choices={
                    "options": [t.text for t in word.translations.all()[:4]],
                    "correct": word.translations.filter(is_correct=True).first().text
                },
                correct_answer=word.translations.filter(is_correct=True).first().text
            )
            print(f"Created quiz item {i}: {word.text}")
            
        # Level 2の単語でもう一つのQuizSetを作成
        quiz_set2 = QuizSet.objects.create(
            user=user,
            name="テスト用クイズセット Level 2", 
            grade=2,
            total_questions=10,
            pos_filter={}  # 空のJSONオブジェクトを設定
        )
        print(f"Created quiz set: {quiz_set2.name}")
        
        level2_words = Word.objects.filter(grade=2)[:10]
        for i, word in enumerate(level2_words, 1):
            quiz_item = QuizItem.objects.create(
                quiz_set=quiz_set2,
                word=word,
                question_number=i,
                choices={
                    "options": [t.text for t in word.translations.all()[:4]],
                    "correct": word.translations.filter(is_correct=True).first().text
                },
                correct_answer=word.translations.filter(is_correct=True).first().text
            )
            print(f"Created quiz item {i}: {word.text}")
            
    except Exception as e:
        print(f"Error creating quiz sets: {e}")
    
    print("Data loading completed!")
    
    # 統計情報を表示
    print(f"\nDatabase Statistics:")
    print(f"Total Words: {Word.objects.count()}")
    try:
        print(f"Total Translations: {WordTranslation.objects.count()}")
    except Exception as e:
        print(f"Error counting translations: {e}")
    print(f"Total Quiz Sets: {QuizSet.objects.count()}")
    print(f"Total Quiz Items: {QuizItem.objects.count()}")

if __name__ == '__main__':
    load_test_data()
