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

from quiz.models import User, Vocabulary, VocabTranslation, VocabChoice

def load_test_data():
    """テストデータを投入"""
    
    # テストデータ
    test_words = [
        {
            "text_en": "apple",
            "part_of_speech": "noun",
            "primary_translation": "りんご",
            "other_translations": ["アップル"],
            "dummy_translations": ["バナナ", "オレンジ", "ぶどう"],
            "explanation": "名詞。果物のりんごを表す基本語。",
            "example_en": "I eat an apple every morning.",
            "example_ja": "私は毎朝りんごを食べます。"
        },
        {
            "text_en": "book",
            "part_of_speech": "noun",
            "primary_translation": "本",
            "other_translations": ["書籍", "冊子"],
            "dummy_translations": ["ペン", "ノート", "机"],
            "explanation": "名詞。読むための冊子・書籍。",
            "example_en": "I read a book at home.",
            "example_ja": "私は家で本を読みます。"
        },
        {
            "text_en": "dog",
            "part_of_speech": "noun",
            "primary_translation": "犬",
            "other_translations": ["イヌ"],
            "dummy_translations": ["猫", "鳥", "魚"],
            "explanation": "名詞。身近な動物の一種。",
            "example_en": "The dog is very friendly.",
            "example_ja": "その犬はとても人なつこい。"
        },
        {
            "text_en": "water",
            "part_of_speech": "noun",
            "primary_translation": "水",
            "other_translations": ["ウォーター"],
            "dummy_translations": ["牛乳", "ジュース", "お茶"],
            "explanation": "名詞。飲用や生活に不可欠な液体。",
            "example_en": "Please drink water.",
            "example_ja": "水を飲んでください。"
        },
        {
            "text_en": "school",
            "part_of_speech": "noun",
            "primary_translation": "学校",
            "other_translations": ["スクール"],
            "dummy_translations": ["病院", "公園", "駅"],
            "explanation": "名詞。学ぶための施設や組織。",
            "example_en": "I go to school every day.",
            "example_ja": "私は毎日学校に行きます。"
        },
        {
            "text_en": "chair",
            "part_of_speech": "noun",
            "primary_translation": "いす",
            "other_translations": ["椅子"],
            "dummy_translations": ["机", "窓", "ドア"],
            "explanation": "名詞。座るための家具。",
            "example_en": "This chair is new.",
            "example_ja": "このいすは新しい。"
        },
        {
            "text_en": "morning",
            "part_of_speech": "noun",
            "primary_translation": "朝",
            "other_translations": ["午前"],
            "dummy_translations": ["夜", "午後", "夕方"],
            "explanation": "名詞。日の出から昼頃までの時間帯。",
            "example_en": "I get up early in the morning.",
            "example_ja": "私は朝早く起きます。"
        },
        {
            "text_en": "big",
            "part_of_speech": "adjective",
            "primary_translation": "大きい",
            "other_translations": ["大きな"],
            "dummy_translations": ["小さい", "速い", "遅い"],
            "explanation": "形容詞。「大きい」の意味。",
            "example_en": "This box is big.",
            "example_ja": "この箱は大きい。"
        },
        {
            "text_en": "run",
            "part_of_speech": "verb",
            "primary_translation": "走る",
            "other_translations": ["かけっこする"],
            "dummy_translations": ["歩く", "飛ぶ", "泳ぐ"],
            "explanation": "動詞。「走る」の意味で日常的に用いる。",
            "example_en": "He runs fast.",
            "example_ja": "彼は速く走る。"
        },
        {
            "text_en": "eat",
            "part_of_speech": "verb",
            "primary_translation": "食べる",
            "other_translations": ["食う"],
            "dummy_translations": ["飲む", "読む", "書く"],
            "explanation": "動詞。食物を口に入れて摂取する。",
            "example_en": "We eat lunch at noon.",
            "example_ja": "私たちは正午に昼食を食べます。"
        },
        {
            "text_en": "train",
            "part_of_speech": "noun",
            "primary_translation": "電車",
            "other_translations": ["列車", "汽車"],
            "dummy_translations": ["バス", "自転車", "飛行機"],
            "explanation": "名詞。レール上を走る公共交通機関。",
            "example_en": "I go to school by train.",
            "example_ja": "私は電車で学校に行きます。"
        },
        {
            "text_en": "city",
            "part_of_speech": "noun",
            "primary_translation": "都市",
            "other_translations": ["街", "市"],
            "dummy_translations": ["村", "川", "山"],
            "explanation": "名詞。人口が多く発達した地域。",
            "example_en": "Tokyo is a big city.",
            "example_ja": "東京は大きな都市です。"
        },
        {
            "text_en": "family",
            "part_of_speech": "noun",
            "primary_translation": "家族",
            "other_translations": ["ファミリー"],
            "dummy_translations": ["友だち", "先生", "生徒"],
            "explanation": "名詞。親子・兄弟などの集まり。",
            "example_en": "My family is small.",
            "example_ja": "私の家族は小さいです。"
        },
        {
            "text_en": "teacher",
            "part_of_speech": "noun",
            "primary_translation": "先生",
            "other_translations": ["教師", "教員"],
            "dummy_translations": ["生徒", "家族", "友だち"],
            "explanation": "名詞。教えることを職業とする人。",
            "example_en": "Our teacher is kind.",
            "example_ja": "私たちの先生は親切です。"
        },
        {
            "text_en": "happy",
            "part_of_speech": "adjective",
            "primary_translation": "うれしい",
            "other_translations": ["幸せな", "喜んでいる"],
            "dummy_translations": ["悲しい", "怒っている", "忙しい"],
            "explanation": "形容詞。気持ちが満たされた状態。",
            "example_en": "I am happy today.",
            "example_ja": "私は今日はうれしい。"
        },
        {
            "text_en": "cold",
            "part_of_speech": "adjective",
            "primary_translation": "寒い",
            "other_translations": ["冷たい"],
            "dummy_translations": ["暑い", "暖かい", "涼しい"],
            "explanation": "形容詞。気温が低いことを表す。",
            "example_en": "It is cold in winter.",
            "example_ja": "冬は寒い。"
        },
        {
            "text_en": "write",
            "part_of_speech": "verb",
            "primary_translation": "書く",
            "other_translations": ["記す"],
            "dummy_translations": ["読む", "話す", "見る"],
            "explanation": "動詞。文字や文を記す。",
            "example_en": "I write a diary every night.",
            "example_ja": "私は毎晩日記を書きます。"
        },
        {
            "text_en": "open",
            "part_of_speech": "verb",
            "primary_translation": "開ける",
            "other_translations": ["開く"],
            "dummy_translations": ["閉める", "押す", "置く"],
            "explanation": "動詞。ドアや窓などを開ける。",
            "example_en": "Please open the door.",
            "example_ja": "ドアを開けてください。"
        },
        {
            "text_en": "music",
            "part_of_speech": "noun",
            "primary_translation": "音楽",
            "other_translations": ["ミュージック"],
            "dummy_translations": ["映画", "ゲーム", "本"],
            "explanation": "名詞。歌や演奏などの芸術。",
            "example_en": "I like music very much.",
            "example_ja": "私は音楽がとても好きです。"
        },
        {
            "text_en": "lunch",
            "part_of_speech": "noun",
            "primary_translation": "昼食",
            "other_translations": ["ランチ", "昼ごはん"],
            "dummy_translations": ["朝食", "夕食", "おやつ"],
            "explanation": "名詞。正午ごろに食べる食事。",
            "example_en": "We have lunch at twelve.",
            "example_ja": "私たちは12時に昼食をとります。"
        }
    ]
    
    print("Starting data loading...")
    
    # 開発ユーザーを取得または作成
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
    
    # 単語とその翻訳・選択肢を作成
    vocabs_created = 0
    for word_data in test_words:
        try:
            # Vocabularyオブジェクトを作成
            vocab, created = Vocabulary.objects.get_or_create(
                text_en=word_data['text_en'],
                created_by_user=user,
                defaults={
                    'part_of_speech': word_data['part_of_speech'],
                    'explanation': word_data['explanation'],
                    'example_en': word_data.get('example_en', ''),
                    'example_ja': word_data.get('example_ja', ''),
                    'visibility': 'private',
                    'status': 'published'
                }
            )
            
            if created:
                vocabs_created += 1
                print(f"Created vocabulary: {vocab.text_en}")
                
                # プライマリ翻訳を作成
                VocabTranslation.objects.create(
                    vocabulary=vocab,
                    text_ja=word_data['primary_translation'],
                    is_primary=True
                )
                
                # その他の翻訳を作成
                for other_trans in word_data.get('other_translations', []):
                    VocabTranslation.objects.create(
                        vocabulary=vocab,
                        text_ja=other_trans,
                        is_primary=False
                    )
                
                # 正解の選択肢（プライマリ翻訳）
                VocabChoice.objects.create(
                    vocabulary=vocab,
                    text_ja=word_data['primary_translation'],
                    is_correct=True,
                    weight=1.0
                )
                
                # ダミー選択肢を作成
                for i, dummy in enumerate(word_data.get('dummy_translations', []), 1):
                    VocabChoice.objects.create(
                        vocabulary=vocab,
                        text_ja=dummy,
                        is_correct=False,
                        weight=0.8 - (i * 0.1)
                    )
                    
        except Exception as e:
            print(f"Error creating vocabulary {word_data['text_en']}: {e}")
    
    print(f"Created {vocabs_created} vocabularies")
    print("Data loading completed!")
    
    # 統計情報を表示
    print(f"\nDatabase Statistics:")
    print(f"Total Vocabularies: {Vocabulary.objects.count()}")
    print(f"Total Translations: {VocabTranslation.objects.count()}")
    print(f"Total Choices: {VocabChoice.objects.count()}")

if __name__ == '__main__':
    load_test_data()
