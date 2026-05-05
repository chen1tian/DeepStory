from __future__ import annotations

import re


USER_MACRO_PATTERN = re.compile(r"<user>", re.IGNORECASE)


def resolve_user_macro(text: str, protagonist_name: str | None) -> str:
    if not text:
        return text
    replacement = (protagonist_name or "").strip() or "主角"
    return USER_MACRO_PATTERN.sub(replacement, text)
