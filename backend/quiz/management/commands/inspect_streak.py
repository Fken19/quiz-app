from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.utils import timezone

from quiz import models


class Command(BaseCommand):
    help = "Inspect streak calculation for a user over recent days"

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="User email to inspect")
        parser.add_argument("--days", type=int, default=14, help="How many days back to list (default: 14)")

    def handle(self, *args: Any, **options: Any):
        User = get_user_model()
        email = options["email"]
        days = max(1, min(int(options.get("days", 14)), 365))

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise CommandError(f"User not found for email: {email}")

        today = timezone.localdate()
        date_from = today - timedelta(days=days - 1)
        qs = (
            models.LearningSummaryDaily.objects.filter(user=user, activity_date__gte=date_from, activity_date__lte=today)
            .order_by("activity_date")
            .values("activity_date", "correct_count", "incorrect_count", "timeout_count", "total_time_ms")
        )

        self.stdout.write(self.style.NOTICE(f"Inspecting streak for {email}"))
        self.stdout.write(self.style.NOTICE(f"Today (local): {today}"))
        self.stdout.write("\nRecent daily rows:")
        for row in qs:
            d = row["activity_date"].isoformat()
            cc = row.get("correct_count") or 0
            ic = row.get("incorrect_count") or 0
            to = row.get("timeout_count") or 0
            tm = row.get("total_time_ms") or 0
            active = (cc + ic + to) > 0
            self.stdout.write(f"  {d}: correct={cc} incorrect={ic} timeout={to} time_ms={tm} active={active}")

        recent_rows = list(qs)
        active_dates = {
            r["activity_date"]
            for r in recent_rows
            if ((r.get("correct_count") or 0) + (r.get("incorrect_count") or 0) + (r.get("timeout_count") or 0)) > 0
        }

        if today in active_dates:
            anchor = today
        elif (today - timedelta(days=1)) in active_dates:
            anchor = today - timedelta(days=1)
        else:
            anchor = None

        current_streak = 0
        if anchor is not None:
            d = anchor
            while d in active_dates:
                current_streak += 1
                d = d - timedelta(days=1)

        self.stdout.write("\nComputed:")
        self.stdout.write(f"  anchor={anchor}")
        self.stdout.write(f"  active_dates={sorted(list(active_dates))}")
        self.stdout.write(self.style.SUCCESS(f"  current_streak={current_streak}"))
