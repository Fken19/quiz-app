import datetime


def parse_date_param(value: str | None):
    if not value:
        return None
    try:
        return datetime.date.fromisoformat(value)
    except Exception:
        return None


__all__ = ["parse_date_param"]
