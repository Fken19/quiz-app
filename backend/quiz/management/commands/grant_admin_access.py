from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from quiz.models import Teacher, TeacherWhitelist


class Command(BaseCommand):
    help = "指定メールアドレスを講師ホワイトリストに追加し、Django 管理画面へのアクセスを許可します"

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            required=True,
            help="管理画面アクセスを付与したいユーザーのメールアドレス",
        )
        parser.add_argument(
            "--can-publish",
            action="store_true",
            default=True,
            help="語彙の公開権限を付与するか（デフォルト: 付与する）",
        )
        parser.add_argument(
            "--note",
            default="Granted via grant_admin_access",
            help="ホワイトリストレコードに残すメモ",
        )
        parser.add_argument(
            "--create-teacher",
            action="store_true",
            default=False,
            help="対応する Teacher レコードが無い場合に作成する",
        )
        parser.add_argument(
            "--oauth-provider",
            default="google",
            help="Teacher を作成する場合の oauth_provider（--create-teacher 指定時のみ）",
        )
        parser.add_argument(
            "--oauth-sub",
            default=None,
            help="Teacher を作成する場合の oauth_sub（省略時は 'manual_admin' を使用）",
        )

    def handle(self, *args, **options):
        email_raw: str = options["email"]
        if not email_raw:
            raise CommandError("--email は必須です")

        email = email_raw.strip().lower()

        # 既に有効なホワイトリストがあれば何もしない
        exists_active = TeacherWhitelist.objects.filter(
            email__iexact=email,
            revoked_at__isnull=True,
        ).exists()
        if exists_active:
            self.stdout.write(self.style.SUCCESS(f"Already whitelisted: {email}"))
            return

        created_by_teacher = None
        if options.get("create_teacher"):
            created_by_teacher = Teacher.objects.filter(email__iexact=email).first()
            if not created_by_teacher:
                oauth_provider = options.get("oauth_provider") or "google"
                oauth_sub = options.get("oauth_sub") or "manual_admin"
                created_by_teacher = Teacher.objects.create(
                    email=email,
                    oauth_provider=oauth_provider,
                    oauth_sub=oauth_sub,
                )

        tw = TeacherWhitelist.objects.create(
            email=email,
            can_publish_vocab=bool(options.get("can_publish", True)),
            note=options.get("note") or "",
            created_by=created_by_teacher,
        )

        self.stdout.write(self.style.SUCCESS(f"Whitelisted: {tw.email}"))
        if created_by_teacher:
            self.stdout.write(self.style.SUCCESS(f"Teacher ensured: {created_by_teacher.email}"))
