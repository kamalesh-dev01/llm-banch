"""
Time utilities providing naive UTC datetime instances.
Avoids deprecated datetime.utcnow() while maintaining naive-UTC compatibility with database models.
"""
from datetime import datetime, timezone


def utcnow() -> datetime:
    """Returns current naive UTC datetime (tzinfo=None) to match existing database conventions."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
