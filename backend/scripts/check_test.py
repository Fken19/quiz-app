from django.apps import apps

Test = apps.get_model('quiz', 'Test')
fields = [(f.name, f.__class__.__name__) for f in Test._meta.fields]
print('FIELDS=', fields)

t = Test.objects.order_by('-id').first()
if t:
    print('\nLATEST TEST:')
    for k, _ in fields:
        if hasattr(t, k):
            val = getattr(t, k)
            print(f'  {k}: {val}')
