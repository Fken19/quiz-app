import os
import json
import django

# Django設定の読み込み
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quiz_backend.settings')
django.setup()

from quiz.models import Question, Option

jsonl_path = os.path.join(os.path.dirname(__file__), 'sample_questions.jsonl')

with open(jsonl_path, 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        word = data['word']
        correct = data['correct']
        dummies = data['dummy']

        # Question作成
        q, created = Question.objects.get_or_create(text=word)

        # Option（正解）
        Option.objects.get_or_create(question=q, text=correct, is_correct=True)

        # Option（ダミー）
        for dummy in dummies:
            Option.objects.get_or_create(question=q, text=dummy, is_correct=False)

print('サンプル問題データの投入が完了しました。')
