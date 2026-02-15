from django.apps import apps

Test = apps.get_model('quiz', 'Test')
TestQuestion = apps.get_model('quiz', 'TestQuestion')
Vocabulary = apps.get_model('quiz', 'Vocabulary')

test = Test.objects.first()
print(f'Test: {test.title}')

existing_count = TestQuestion.objects.filter(test=test).count()
print(f'Existing questions: {existing_count}')

vocabs = list(Vocabulary.objects.all()[:6])
print(f'Available vocabs: {len(vocabs)}')

# 既存の question_order を取得
existing_orders = set(TestQuestion.objects.filter(test=test).values_list('question_order', flat=True))
print(f'Existing orders: {sorted(existing_orders)}')

# 残りの問題を追加
for i in range(existing_count, min(6, len(vocabs))):
    vocab = vocabs[i]
    order = i + 1
    if order not in existing_orders:
        tq = TestQuestion.objects.create(
            test=test,
            vocabulary=vocab,
            question_order=order
        )
        print(f'  Created TestQuestion {order}: {vocab.text_en}')
    else:
        print(f'  Skipped order {order} (already exists)')

final_count = TestQuestion.objects.filter(test=test).count()
print(f'\nFinal question count: {final_count}')
