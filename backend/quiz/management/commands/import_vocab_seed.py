from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Iterable

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from quiz.models import (
    Quiz,
    QuizCollection,
    QuizQuestion,
    QuizScope,
    Vocabulary,
    VocabChoice,
    VocabStatus,
    VocabTranslation,
    VocabVisibility,
)


@dataclass
class SeedEntry:
    text_en: str
    part_of_speech: str | None
    explanation: str | None
    example_en: str | None
    example_ja: str | None
    translations: list[str]
    correct_choices: list[str]
    dummy_choices: list[str]
    tags: list[str]
    importance: int


def _unique(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if not value:
            continue
        if value in seen:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered


class Command(BaseCommand):
    help = "Import seed vocabulary, translations, choices, and quizzes from the provided JSONL file."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--path",
            type=str,
            default="単語メインファイル.json",
            help="Path to the JSON Lines seed file.",
        )
        parser.add_argument(
            "--collection-prefix",
            type=str,
            default="Vocabulary Collection",
            help="Prefix used when creating quiz collection titles.",
        )
        parser.add_argument(
            "--quiz-size",
            type=int,
            default=10,
            help="Number of questions per quiz.",
        )
        parser.add_argument(
            "--quizzes-per-collection",
            type=int,
            default=10,
            help="Number of quizzes per collection.",
        )

    def handle(self, *args, **options):
        path = Path(options["path"]).expanduser()
        if not path.exists():
            raise CommandError(f"Seed file not found: {path}")

        try:
            entries = self._load_seed_entries(path)
        except json.JSONDecodeError as exc:
            raise CommandError(f"Failed to parse {path}: {exc}") from exc

        quiz_size: int = options["quiz_size"]
        quizzes_per_collection: int = options["quizzes_per_collection"]

        if quiz_size <= 0 or quizzes_per_collection <= 0:
            raise CommandError("quiz-size and quizzes-per-collection must be positive integers")

        with transaction.atomic():
            vocab_map = self._import_vocabularies(entries)
            collection_count, quiz_count, question_count = self._build_quizzes(
                entries,
                vocab_map,
                prefix=options["collection_prefix"],
                quiz_size=quiz_size,
                quizzes_per_collection=quizzes_per_collection,
                seed_name=path.name,
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Imported %d vocabularies, %d quizzes across %d collections (%d questions)."
                % (len(vocab_map), quiz_count, collection_count, question_count)
            )
        )

    def _load_seed_entries(self, path: Path) -> list[SeedEntry]:
        entries: list[SeedEntry] = []
        with path.open("r", encoding="utf-8") as handle:
            for line_number, raw_line in enumerate(handle, start=1):
                stripped = raw_line.strip()
                if not stripped:
                    continue
                payload = json.loads(stripped)
                meta = payload.get("meta", {})
                choices = payload.get("choices", {})
                entry = SeedEntry(
                    text_en=payload.get("text_en") or payload.get("text") or "",
                    part_of_speech=payload.get("part_of_speech"),
                    explanation=payload.get("explanation"),
                    example_en=payload.get("example_en"),
                    example_ja=payload.get("example_ja"),
                    translations=_unique(payload.get("translations", [])),
                    correct_choices=_unique(choices.get("correct", [])),
                    dummy_choices=_unique(choices.get("dummies", [])),
                    tags=_unique(meta.get("tags", [])),
                    importance=int(meta.get("importance", 0)),
                )
                if not entry.text_en:
                    raise CommandError(f"Missing 'text_en' on line {line_number} in {path}")
                entries.append(entry)
        return entries

    def _import_vocabularies(self, entries: list[SeedEntry]) -> dict[str, Vocabulary]:
        vocab_map: dict[str, Vocabulary] = {}
        now = timezone.now()

        for entry in entries:
            vocabulary, _ = Vocabulary.objects.get_or_create(
                text_en=entry.text_en,
                defaults={
                    "visibility": VocabVisibility.PUBLIC,
                    "status": VocabStatus.PUBLISHED,
                    "published_at": now,
                    "sense_count": 1,
                },
            )

            vocabulary.part_of_speech = entry.part_of_speech
            vocabulary.explanation = entry.explanation
            vocabulary.example_en = entry.example_en
            vocabulary.example_ja = entry.example_ja
            vocabulary.visibility = VocabVisibility.PUBLIC
            vocabulary.status = VocabStatus.PUBLISHED
            vocabulary.published_at = vocabulary.published_at or now

            translations = list(entry.translations)
            primary_candidates = translations or entry.correct_choices
            if not primary_candidates:
                raise CommandError(f"No translations available for word '{entry.text_en}'")

            for choice in entry.correct_choices:
                if choice not in translations:
                    translations.append(choice)

            vocabulary.sense_count = max(1, len(translations))
            vocabulary.save()

            vocabulary.translations.all().delete()
            VocabTranslation.objects.bulk_create(
                [
                    VocabTranslation(
                        vocabulary=vocabulary,
                        text_ja=text,
                        is_primary=(index == 0),
                    )
                    for index, text in enumerate(translations)
                ]
            )

            vocabulary.choices.all().delete()
            VocabChoice.objects.bulk_create(
                [
                    VocabChoice(
                        vocabulary=vocabulary,
                        text_ja=text,
                        is_correct=True,
                        weight=Decimal("1.00"),
                    )
                    for text in entry.correct_choices
                ]
                + [
                    VocabChoice(
                        vocabulary=vocabulary,
                        text_ja=text,
                        is_correct=False,
                        weight=Decimal("1.00"),
                    )
                    for text in entry.dummy_choices
                ]
            )

            vocab_map[entry.text_en] = vocabulary

        return vocab_map

    def _build_quizzes(
        self,
        entries: list[SeedEntry],
        vocab_map: dict[str, Vocabulary],
        *,
        prefix: str,
        quiz_size: int,
        quizzes_per_collection: int,
        seed_name: str,
    ) -> tuple[int, int, int]:
        sorted_entries = sorted(
            [entry for entry in entries if entry.text_en in vocab_map],
            key=lambda item: (-item.importance, item.text_en.lower()),
        )

        if not sorted_entries:
            return 0, 0, 0

        words_per_collection = quiz_size * quizzes_per_collection
        collection_count = 0
        quiz_count = 0
        question_count = 0

        for collection_index in range(0, len(sorted_entries), words_per_collection):
            collection_entries = sorted_entries[collection_index : collection_index + words_per_collection]
            if not collection_entries:
                continue

            collection_number = collection_count + 1
            collection_title = f"{prefix} {collection_number:02d}"
            collection, _ = QuizCollection.objects.update_or_create(
                scope=QuizScope.DEFAULT,
                owner_user=None,
                title=collection_title,
                defaults={
                    "description": f"Seed data import from {seed_name}",
                    "order_index": collection_number,
                },
            )

            collection.description = f"Seed data import from {seed_name}"
            collection.order_index = collection_number
            collection.is_published = True
            collection.published_at = collection.published_at or timezone.now()
            collection.save()

            collection.quizzes.all().delete()

            for quiz_index in range(quizzes_per_collection):
                start = quiz_index * quiz_size
                end = start + quiz_size
                quiz_entries = collection_entries[start:end]
                if not quiz_entries:
                    break

                quiz = Quiz.objects.create(
                    quiz_collection=collection,
                    sequence_no=quiz_index + 1,
                    title=f"Quiz {quiz_index + 1:02d}",
                )

                quiz_count += 1

                for order, entry in enumerate(quiz_entries, start=1):
                    vocabulary = vocab_map[entry.text_en]
                    QuizQuestion.objects.create(
                        quiz=quiz,
                        vocabulary=vocabulary,
                        question_order=order,
                    )
                    question_count += 1

            collection_count += 1

        return collection_count, quiz_count, question_count
