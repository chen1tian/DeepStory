from __future__ import annotations

import re
import structlog

log = structlog.get_logger()

# Try tiktoken if available, fall back to estimation
_encoding = None
_use_tiktoken = False

try:
    import tiktoken
    _encoding = tiktoken.encoding_for_model("gpt-4o")
    _use_tiktoken = True
except Exception:
    try:
        import tiktoken
        _encoding = tiktoken.get_encoding("cl100k_base")
        _use_tiktoken = True
    except Exception:
        log.info("tiktoken not available, using estimation-based token counter")

# CJK character range pattern
_CJK_RE = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]")


def _estimate_tokens(text: str) -> int:
    """Estimate token count: CJK chars ~1.5 tokens each, English ~0.75 tokens per word."""
    cjk_chars = len(_CJK_RE.findall(text))
    non_cjk = _CJK_RE.sub(" ", text)
    words = len(non_cjk.split())
    return int(cjk_chars * 1.5 + words * 0.75) + 1


def count_tokens(text: str) -> int:
    if _use_tiktoken and _encoding is not None:
        return len(_encoding.encode(text))
    return _estimate_tokens(text)


def count_messages_tokens(messages: list[dict]) -> int:
    """Count tokens for an OpenAI-formatted messages array.
    
    Each message adds ~4 tokens overhead (role, content delimiters).
    """
    total = 0
    for msg in messages:
        total += 4  # role/content overhead
        total += count_tokens(msg.get("content", ""))
    total += 2  # reply priming
    return total
