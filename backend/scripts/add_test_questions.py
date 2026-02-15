from django.apps import apps
import uuid

Test = apps.get_model('quiz', 'Test')
TestQuestion = apps.get_model('quiz', 'TestQuestion')
Vocabulary = apps.get_model('quiz', 'Vocabulary')

# 作成したテストを取得
test = Test.objects.first()
print(f'Test: {test.title} ({test.id})')

# Vocabularyを取得（既存のものを使用）
vocabs = list(Vocabulary.objects.all()[:6])
print(f'Found {len(vocabs)} vocabularies')

if len(vocabs) < 4:
    print('ERROR: Need at least 4 vocabularies. Creating some...')
    for i in range(4):
        v = Vocabulary.objects.create(
            text_en=f'word{i+1}',
            text_key=f'word{i+1}'.lower()
        )
        vocabs.append(v)
        print(f'  Created vocab: {v.text_en}')

# TestQuestionを作成
for i, vocab in enumerate(vocabs[:6]):
    tq = TestQuestion.objects.create(
        test=test,
        vocabulary=vocab,
        question_order=i + 1
    )
    print(f'  Created TestQuestion {i+1}: {vocab.text_en}')

print(f'\nTotal TestQuestions: {TestQuestion.objects.filter(test=test).count()}')
