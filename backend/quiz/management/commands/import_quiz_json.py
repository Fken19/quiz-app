from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
import json
import os
from datetime import datetime


class Command(BaseCommand):
    help = 'Import quiz data from a JSON file into existing quiz_* tables (minimal, non-destructive)'

    def add_arguments(self, parser):
        parser.add_argument('file', type=str, help='Path to JSON file (array of items)')

    def handle(self, *args, **options):
        path = options['file']
        if not os.path.exists(path):
            raise CommandError(f'File not found: {path}')

        with open(path, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except Exception as e:
                raise CommandError(f'Invalid JSON: {e}')

        if not isinstance(data, list):
            raise CommandError('JSON root must be an array of quiz items')

        inserted_words = 0

        now = datetime.utcnow()

        with transaction.atomic():
            cur = connection.cursor()
            for item in data:
                text = item.get('text')
                pos = item.get('pos')
                grade_raw = item.get('grade')
                # Normalize grade: DB expects integer; map 'J1' -> 1, numeric strings -> int
                grade = None
                if grade_raw is not None:
                    try:
                        if isinstance(grade_raw, str) and grade_raw.upper().startswith('J'):
                            grade = int(grade_raw[1:])
                        else:
                            grade = int(grade_raw)
                    except Exception:
                        grade = None
                level = item.get('level')
                segment = item.get('segment')
                explanation = item.get('explanation') or ''

                if not text:
                    self.stdout.write(self.style.WARNING('Skipping item without text'))
                    continue

                # Try to find existing word by lemma/text and pos
                cur.execute("SELECT id FROM quiz_word WHERE lemma = %s AND pos = %s", [text, pos])
                row = cur.fetchone()
                if row:
                    word_id = row[0]
                    self.stdout.write(f'Updating existing word id={word_id} lemma={text}')
                    # Update some fields
                    cur.execute(
                        "UPDATE quiz_word SET grade = %s, frequency = %s, updated_at = now() WHERE id = %s",
                        [grade or level or None, 1, word_id]
                    )
                else:
                    # Insert into quiz_word (use lemma/pos/grade/frequency)
                    cur.execute(
                        "INSERT INTO quiz_word (lemma, pos, grade, frequency, created_at, updated_at) VALUES (%s,%s,%s,%s,now(),now()) RETURNING id",
                        [text, pos, grade if grade is not None else (level or 1), 1]
                    )
                    word_id = cur.fetchone()[0]
                    inserted_words += 1
                    self.stdout.write(f'Inserted word id={word_id} lemma={text}')

                # Textbook scopes: map to quiz_textbook_scope (name,publisher,grade,description)
                scopes = item.get('textbook_scopes') or []
                for sc in scopes:
                    series = sc.get('series')
                    edition = sc.get('edition')
                    unit = sc.get('unit')
                    range_note = sc.get('range_note')
                    # Use series as unique name in DB; description contains edition/unit
                    desc = f"edition:{edition} unit:{unit} range:{range_note}"
                    # First try to find by name (DB has unique constraint on name)
                    cur.execute("SELECT id FROM quiz_textbook_scope WHERE name=%s", [series])
                    srow = cur.fetchone()
                    if srow:
                        scope_id = srow[0]
                    else:
                        # Insert but guard against race/unique violation
                        try:
                            cur.execute(
                                "INSERT INTO quiz_textbook_scope (name,publisher,grade,description,created_at,updated_at) VALUES (%s,%s,%s,%s,now(),now()) RETURNING id",
                                [series, edition, grade if grade is not None else None, desc]
                            )
                            scope_id = cur.fetchone()[0]
                            self.stdout.write(f'Inserted textbook scope id={scope_id} {series}/{edition}')
                        except Exception:
                            # If unique violation occurred due to concurrent insert, re-query
                            cur.execute("SELECT id FROM quiz_textbook_scope WHERE name=%s", [series])
                            srow2 = cur.fetchone()
                            scope_id = srow2[0] if srow2 else None

                    # Optionally link quiz_quiz_set? skip linking to keep minimal

                # Translations
                prim = item.get('primary_translation')
                dummies = item.get('dummy_translations') or []

                def insert_translation(text_val, is_primary=False):
                    if not text_val:
                        return
                    # avoid duplicate translation for same word
                    cur.execute("SELECT id FROM quiz_word_translation WHERE word_id=%s AND translation=%s", [word_id, text_val])
                    if cur.fetchone():
                        return
                    cur.execute(
                        "INSERT INTO quiz_word_translation (translation, is_primary, context, created_at, updated_at, word_id) VALUES (%s,%s,%s,now(),now(),%s)",
                        [text_val, bool(is_primary), '', word_id]
                    )

                insert_translation(prim, True)
                for d in dummies:
                    insert_translation(d, False)

                # Example sentences
                examples = item.get('example_sentences') or []
                for ex in examples:
                    en = ex.get('en') or ex.get('english')
                    ja = ex.get('ja') or ex.get('japanese')
                    source = ex.get('source') or ''
                    if not en:
                        continue
                    # avoid exact duplicate
                    cur.execute("SELECT id FROM quiz_example_sentence WHERE word_id=%s AND english=%s", [word_id, en])
                    if cur.fetchone():
                        continue
                    cur.execute(
                        "INSERT INTO quiz_example_sentence (english,japanese,created_at,updated_at,word_id) VALUES (%s,%s,now(),now(),%s)",
                        [en, ja, word_id]
                    )

        self.stdout.write(self.style.SUCCESS(f'Import complete: inserted_words={inserted_words}'))
