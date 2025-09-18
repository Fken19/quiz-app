"""
新しいクイズスキーマ用のマイグレーション - Phase 4: Sample Data
"""
from django.db import migrations


def insert_sample_data(apps, schema_editor):
    """サンプルデータを挿入"""
    Level = apps.get_model('quiz', 'Level')
    Segment = apps.get_model('quiz', 'Segment') 
    NewWord = apps.get_model('quiz', 'NewWord')
    WordTranslation = apps.get_model('quiz', 'NewWordTranslation')
    WordChoice = apps.get_model('quiz', 'NewWordChoice')
    SegmentWord = apps.get_model('quiz', 'SegmentWord')
    
    # レベル1作成
    level1 = Level.objects.create(
        level_id='11111111-1111-1111-1111-111111111111',
        level_name='レベル1'
    )
    
    # セグメント1作成（最初は draft）
    segment1 = Segment.objects.create(
        segment_id='22222222-2222-2222-2222-222222222222',
        level_id=level1,
        segment_name='セグメント1',
        publish_status='draft'
    )
    
    # 単語データ（10問）
    words_data = [
        ('10000000-0000-0000-0000-000000000001', 'apple', 'noun', 'Plural: apples.', 'This is an apple.', 'これはりんごです。'),
        ('10000000-0000-0000-0000-000000000002', 'book', 'noun', 'Plural: books.', 'I have a book.', '私は本を持っています。'),
        ('10000000-0000-0000-0000-000000000003', 'cat', 'noun', 'Plural: cats.', 'The cat is cute.', 'その猫はかわいいです。'),
        ('10000000-0000-0000-0000-000000000004', 'run', 'verb', '3rd: runs, Past: ran.', 'I run every morning.', '私は毎朝走ります。'),
        ('10000000-0000-0000-0000-000000000005', 'eat', 'verb', '3rd: eats, Past: ate, PP: eaten.', "Let's eat lunch.", '昼ごはんを食べましょう。'),
        ('10000000-0000-0000-0000-000000000006', 'big', 'adjective', 'Comparative: bigger, Superlative: biggest.', 'This bag is big.', 'このかばんは大きいです。'),
        ('10000000-0000-0000-0000-000000000007', 'small', 'adjective', 'Comparative: smaller, Superlative: smallest.', 'The room is small.', 'その部屋は小さいです。'),
        ('10000000-0000-0000-0000-000000000008', 'happy', 'adjective', 'Comparative: happier, Superlative: happiest.', 'I am happy today.', '今日はうれしいです。'),
        ('10000000-0000-0000-0000-000000000009', 'go', 'verb', '3rd: goes, Past: went, PP: gone.', 'I go to school.', '私は学校に行きます。'),
        ('10000000-0000-0000-0000-000000000010', 'study', 'verb', '3rd: studies, Past: studied.', 'I study English.', '私は英語を勉強します。'),
    ]
    
    # 単語を作成
    words = []
    for word_data in words_data:
        word = NewWord.objects.create(
            word_id=word_data[0],
            text_en=word_data[1],
            part_of_speech=word_data[2],
            explanation=word_data[3],
            example_en=word_data[4],
            example_ja=word_data[5]
        )
        words.append(word)
    
    # 正答集合（各単語1件、常に is_correct=true）
    translations_data = [
        ('10000000-0000-0000-0000-000000000001', 'りんご'),
        ('10000000-0000-0000-0000-000000000002', '本'),
        ('10000000-0000-0000-0000-000000000003', '猫'),
        ('10000000-0000-0000-0000-000000000004', '走る'),
        ('10000000-0000-0000-0000-000000000005', '食べる'),
        ('10000000-0000-0000-0000-000000000006', '大きい'),
        ('10000000-0000-0000-0000-000000000007', '小さい'),
        ('10000000-0000-0000-0000-000000000008', 'うれしい'),
        ('10000000-0000-0000-0000-000000000009', '行く'),
        ('10000000-0000-0000-0000-000000000010', '勉強する'),
    ]
    
    # 正答集合を作成
    word_dict = {word.word_id: word for word in words}
    for translation_data in translations_data:
        word = word_dict[translation_data[0]]
        WordTranslation.objects.create(
            word_id=word,
            text_ja=translation_data[1],
            is_correct=True
        )
    
    # 選択肢データ（各単語：正解1 + ダミー3 = 4択）
    choices_data = [
        # apple
        ('10000000-0000-0000-0000-000000000001', [('りんご', True), ('みかん', False), ('ぶどう', False), ('なし', False)]),
        # book  
        ('10000000-0000-0000-0000-000000000002', [('本', True), ('ノート', False), ('かばん', False), ('えんぴつ', False)]),
        # cat
        ('10000000-0000-0000-0000-000000000003', [('猫', True), ('犬', False), ('うさぎ', False), ('鳥', False)]),
        # run
        ('10000000-0000-0000-0000-000000000004', [('走る', True), ('歩く', False), ('立つ', False), ('座る', False)]),
        # eat
        ('10000000-0000-0000-0000-000000000005', [('食べる', True), ('飲む', False), ('見る', False), ('読む', False)]),
        # big
        ('10000000-0000-0000-0000-000000000006', [('大きい', True), ('小さい', False), ('長い', False), ('低い', False)]),
        # small
        ('10000000-0000-0000-0000-000000000007', [('小さい', True), ('大きい', False), ('長い', False), ('広い', False)]),
        # happy
        ('10000000-0000-0000-0000-000000000008', [('うれしい', True), ('悲しい', False), ('怒っている', False), ('退屈な', False)]),
        # go
        ('10000000-0000-0000-0000-000000000009', [('行く', True), ('来る', False), ('待つ', False), ('止まる', False)]),
        # study
        ('10000000-0000-0000-0000-000000000010', [('勉強する', True), ('遊ぶ', False), ('寝る', False), ('働く', False)]),
    ]
    
    # 選択肢を作成
    for choice_data in choices_data:
        word = word_dict[choice_data[0]]
        for choice_text, is_correct in choice_data[1]:
            WordChoice.objects.create(
                word_id=word,
                text_ja=choice_text,
                is_correct=is_correct
            )
    
    # セグメント1に10問を割当（順序1..10）
    for i, word in enumerate(words, 1):
        SegmentWord.objects.create(
            segment_id=segment1,
            word_id=word,
            question_order=i
        )
    
    # セグメント1を公開（10問そろっているのでガードに合格）
    segment1.publish_status = 'published'
    segment1.save()


def reverse_sample_data(apps, schema_editor):
    """サンプルデータを削除"""
    Level = apps.get_model('quiz', 'Level')
    Level.objects.filter(level_id='11111111-1111-1111-1111-111111111111').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0016_legacy_compatibility_relations'),
    ]

    operations = [
        migrations.RunPython(insert_sample_data, reverse_sample_data),
    ]
