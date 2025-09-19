from django.core.management.base import BaseCommand
from django.apps import apps
from django.db import connection


class Command(BaseCommand):
    help = 'Check model fields (db_column) against PostgreSQL information_schema for the quiz app.'

    def add_arguments(self, parser):
        parser.add_argument('--app', default='quiz', help='App label to check (default: quiz)')

    def handle(self, *args, **options):
        app_label = options['app']
        app_config = apps.get_app_config(app_label)

        self.stdout.write(self.style.NOTICE(f'Checking models for app: {app_label}'))

        cursor = connection.cursor()

        overall_missing = {}
        overall_extra = {}

        for model in app_config.get_models():
            meta = model._meta
            table_name = meta.db_table
            # gather expected columns from model fields
            expected = set()
            for field in meta.fields:
                # prefer explicit db_column, then field.column, then attname
                col = getattr(field, 'db_column', None) or getattr(field, 'column', None) or getattr(field, 'attname', None)
                if col:
                    expected.add(str(col))

            # fetch actual columns from information_schema
            cursor.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_name = %s",
                [table_name]
            )
            rows = cursor.fetchall()
            actual = set(r[0] for r in rows)

            missing = expected - actual
            extra = actual - expected

            if missing or extra:
                self.stdout.write(self.style.WARNING(f'---- {model.__name__} (table: {table_name}) ----'))
                if missing:
                    self.stdout.write(self.style.ERROR(f'Missing columns ({len(missing)}): {sorted(list(missing))}'))
                    overall_missing[table_name] = sorted(list(missing))
                else:
                    self.stdout.write(self.style.SUCCESS('No missing columns.'))
                if extra:
                    self.stdout.write(self.style.WARNING(f'Extra columns in DB ({len(extra)}): {sorted(list(extra))}'))
                    overall_extra[table_name] = sorted(list(extra))
                else:
                    self.stdout.write(self.style.SUCCESS('No extra columns.'))

        # summary
        self.stdout.write('\n')
        self.stdout.write(self.style.NOTICE('Summary:'))
        if overall_missing:
            self.stdout.write(self.style.ERROR('Tables with missing columns:'))
            for t, cols in overall_missing.items():
                self.stdout.write(f'  {t}: {cols}')
        else:
            self.stdout.write(self.style.SUCCESS('No missing columns detected.'))

        if overall_extra:
            self.stdout.write(self.style.WARNING('Tables with extra columns:'))
            for t, cols in overall_extra.items():
                self.stdout.write(f'  {t}: {cols}')
        else:
            self.stdout.write(self.style.SUCCESS('No extra columns detected.'))

        self.stdout.write(self.style.NOTICE('Done.'))
