import os
import django
import sys

# Djangoの設定
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quiz_backend.settings')
django.setup()

from quiz.models import Word, WordTranslation

# サンプル単語データ
sample_words = [
    # 初級
    {"word": "hello", "pronunciation": "həˈloʊ", "part_of_speech": "interjection", "difficulty": "beginner", "level": 1, "segment": "greetings",
     "translations": [
         {"translation": "こんにちは", "is_correct": True, "context": "挨拶"},
         {"translation": "おはよう", "is_correct": False, "context": "朝の挨拶"},
         {"translation": "こんばんは", "is_correct": False, "context": "夜の挨拶"}
     ]},
    {"word": "goodbye", "pronunciation": "ɡʊdˈbaɪ", "part_of_speech": "interjection", "difficulty": "beginner", "level": 1, "segment": "greetings",
     "translations": [
         {"translation": "さようなら", "is_correct": True, "context": "別れの挨拶"},
         {"translation": "また明日", "is_correct": False, "context": "明日会う予定の別れ"},
         {"translation": "お疲れ様", "is_correct": False, "context": "仕事の別れ"}
     ]},
    {"word": "apple", "pronunciation": "ˈæpəl", "part_of_speech": "noun", "difficulty": "beginner", "level": 1, "segment": "food",
     "translations": [
         {"translation": "りんご", "is_correct": True, "context": "果物"},
         {"translation": "みかん", "is_correct": False, "context": "柑橘類"},
         {"translation": "バナナ", "is_correct": False, "context": "熱帯果物"}
     ]},
    {"word": "book", "pronunciation": "bʊk", "part_of_speech": "noun", "difficulty": "beginner", "level": 1, "segment": "education",
     "translations": [
         {"translation": "本", "is_correct": True, "context": "読み物"},
         {"translation": "雑誌", "is_correct": False, "context": "定期刊行物"},
         {"translation": "新聞", "is_correct": False, "context": "日刊紙"}
     ]},
    {"word": "water", "pronunciation": "ˈwɔːtər", "part_of_speech": "noun", "difficulty": "beginner", "level": 1, "segment": "basic",
     "translations": [
         {"translation": "水", "is_correct": True, "context": "液体"},
         {"translation": "お湯", "is_correct": False, "context": "温かい水"},
         {"translation": "氷", "is_correct": False, "context": "固体の水"}
     ]},
    
    # 中級
    {"word": "accomplish", "pronunciation": "əˈkʌmplɪʃ", "part_of_speech": "verb", "difficulty": "intermediate", "level": 3, "segment": "achievement",
     "translations": [
         {"translation": "達成する", "is_correct": True, "context": "目標を成し遂げる"},
         {"translation": "始める", "is_correct": False, "context": "新しく開始する"},
         {"translation": "諦める", "is_correct": False, "context": "断念する"}
     ]},
    {"word": "knowledge", "pronunciation": "ˈnɑːlɪdʒ", "part_of_speech": "noun", "difficulty": "intermediate", "level": 3, "segment": "education",
     "translations": [
         {"translation": "知識", "is_correct": True, "context": "学んだ情報"},
         {"translation": "経験", "is_correct": False, "context": "実際に体験したこと"},
         {"translation": "想像", "is_correct": False, "context": "頭の中で思い描くこと"}
     ]},
    {"word": "environment", "pronunciation": "ɪnˈvaɪrənmənt", "part_of_speech": "noun", "difficulty": "intermediate", "level": 3, "segment": "nature",
     "translations": [
         {"translation": "環境", "is_correct": True, "context": "周囲の状況"},
         {"translation": "気候", "is_correct": False, "context": "天候の状況"},
         {"translation": "地域", "is_correct": False, "context": "特定の場所"}
     ]},
    {"word": "opportunity", "pronunciation": "ˌɑːpərˈtuːnəti", "part_of_speech": "noun", "difficulty": "intermediate", "level": 3, "segment": "business",
     "translations": [
         {"translation": "機会", "is_correct": True, "context": "チャンス"},
         {"translation": "困難", "is_correct": False, "context": "難しい状況"},
         {"translation": "結果", "is_correct": False, "context": "何かの成果"}
     ]},
    {"word": "consideration", "pronunciation": "kənˌsɪdəˈreɪʃən", "part_of_speech": "noun", "difficulty": "intermediate", "level": 3, "segment": "thinking",
     "translations": [
         {"translation": "考慮", "is_correct": True, "context": "よく考えること"},
         {"translation": "無視", "is_correct": False, "context": "気にしないこと"},
         {"translation": "即決", "is_correct": False, "context": "すぐに決めること"}
     ]},
    
    # 上級
    {"word": "contemporary", "pronunciation": "kənˈtempəreri", "part_of_speech": "adjective", "difficulty": "advanced", "level": 5, "segment": "time",
     "translations": [
         {"translation": "現代の", "is_correct": True, "context": "現在の時代の"},
         {"translation": "古代の", "is_correct": False, "context": "昔の時代の"},
         {"translation": "未来の", "is_correct": False, "context": "将来の時代の"}
     ]},
    {"word": "sophisticated", "pronunciation": "səˈfɪstɪkeɪtɪd", "part_of_speech": "adjective", "difficulty": "advanced", "level": 5, "segment": "quality",
     "translations": [
         {"translation": "洗練された", "is_correct": True, "context": "高度で複雑な"},
         {"translation": "単純な", "is_correct": False, "context": "簡単で分かりやすい"},
         {"translation": "古風な", "is_correct": False, "context": "昔ながらの"}
     ]},
    {"word": "ambiguous", "pronunciation": "æmˈbɪɡjuəs", "part_of_speech": "adjective", "difficulty": "advanced", "level": 5, "segment": "communication",
     "translations": [
         {"translation": "曖昧な", "is_correct": True, "context": "はっきりしない"},
         {"translation": "明確な", "is_correct": False, "context": "はっきりしている"},
         {"translation": "簡潔な", "is_correct": False, "context": "短くまとまった"}
     ]},
    {"word": "nevertheless", "pronunciation": "ˌnevərðəˈles", "part_of_speech": "adverb", "difficulty": "advanced", "level": 5, "segment": "logic",
     "translations": [
         {"translation": "それにもかかわらず", "is_correct": True, "context": "逆接の接続詞"},
         {"translation": "その結果", "is_correct": False, "context": "結果を示す"},
         {"translation": "例えば", "is_correct": False, "context": "例を示す"}
     ]},
    {"word": "tremendous", "pronunciation": "trɪˈmendəs", "part_of_speech": "adjective", "difficulty": "advanced", "level": 5, "segment": "degree",
     "translations": [
         {"translation": "とても大きな", "is_correct": True, "context": "程度が非常に大きい"},
         {"translation": "とても小さな", "is_correct": False, "context": "程度が非常に小さい"},
         {"translation": "普通の", "is_correct": False, "context": "平均的な"}
     ]}
]

def load_sample_data():
    """サンプルデータを読み込む"""
    print("サンプル単語データを読み込んでいます...")
    
    for word_data in sample_words:
        # 既存の単語をチェック
        if Word.objects.filter(text=word_data['word']).exists():
            print(f"単語 '{word_data['word']}' は既に存在します。スキップします。")
            continue
        
        # 単語を作成（新しいモデル構造に合わせて調整）
        word = Word.objects.create(
            text=word_data['word'],
            level=word_data['level'],
            segment=word_data['level'],  # segmentもlevelに合わせる
            difficulty=0.3 if word_data['difficulty'] == 'beginner' else 0.5 if word_data['difficulty'] == 'intermediate' else 0.8
        )
        
        # 翻訳を作成
        for translation_data in word_data['translations']:
            WordTranslation.objects.create(
                word=word,
                text=translation_data['translation'],
                is_correct=translation_data['is_correct']
            )
        
        print(f"単語 '{word.text}' を追加しました。")
    
    print(f"サンプルデータの読み込みが完了しました。")
    print(f"総単語数: {Word.objects.count()}")
    print(f"総翻訳数: {WordTranslation.objects.count()}")

if __name__ == '__main__':
    load_sample_data()
