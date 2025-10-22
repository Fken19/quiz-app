from quiz.views import QuizResponse, TruncDate, Sum, Count, Case, When, IntegerField, Q
from django.utils import timezone
from datetime import timedelta

now = timezone.now()
last_15 = now - timedelta(days=15)
qs = QuizResponse.objects.filter(quiz_set__user_id='00000000-0000-0000-0000-000000000000')

agg = qs.filter(created_at__gte=last_15).annotate(bucket=TruncDate('created_at')).values('bucket').annotate(
    correct=Sum(Case(When(is_correct=True, then=1), default=0, output_field=IntegerField())),
    incorrect=Sum(Case(When(Q(is_correct=False) & ~(Q(reaction_time_ms__isnull=True) | Q(reaction_time_ms=0) | Q(selected_translation__isnull=True) | Q(selected_translation__text='Unknown')), then=1), default=0, output_field=IntegerField())),
    timeout=Sum(Case(When(Q(is_correct=False) & (Q(reaction_time_ms__isnull=True) | Q(reaction_time_ms=0) | Q(selected_translation__isnull=True) | Q(selected_translation__text='Unknown')), then=1), default=0, output_field=IntegerField())),
    total=Count('id')
).order_by('bucket')

print('COMPILED SQL:')
print(str(agg.query))
print('\nDone')
