from __future__ import annotations

import json

import aiofiles
import structlog

from app.config import settings
from app.models.schemas import Message, SummaryData, StateData
from app.services.llm_service import chat_completion
from app.services.token_counter import count_tokens
from app.storage.file_storage import read_json, write_json

log = structlog.get_logger()

_template_cache: dict[str, str] = {}


async def _load_template(name: str) -> str:
    if name not in _template_cache:
        path = settings.prompts_dir / name
        async with aiofiles.open(path, "r", encoding="utf-8") as f:
            _template_cache[name] = await f.read()
    return _template_cache[name]


async def should_summarize(session_id: str, branch_messages: list[Message]) -> bool:
    """Check if we need to update the rolling summary.
    
    Summarize when the number of messages since last summary exceeds
    what the context window can hold raw.
    """
    summary_data = await _load_summary(session_id)
    unsummarized_count = len(branch_messages) - summary_data.last_summarized_index
    # Trigger summarization when we have more than 6 unsummarized message pairs
    return unsummarized_count >= 12


async def _load_summary(session_id: str) -> SummaryData:
    data = await read_json(session_id, "summary.json")
    if data is None:
        return SummaryData()
    return SummaryData(**data)


async def incremental_summarize(session_id: str, branch_messages: list[Message]) -> SummaryData:
    """Perform incremental summarization: old summary + new messages → new summary."""
    summary = await _load_summary(session_id)

    new_msgs = branch_messages[summary.last_summarized_index:]
    if not new_msgs:
        return summary

    # Format new messages as text
    new_text = "\n".join(
        f"{'用户' if m.role == 'user' else '助手'}: {m.content}"
        for m in new_msgs
    )

    template = await _load_template("summarize.txt")
    prompt = template.format(
        previous_summary=summary.rolling_summary or "（这是对话的开始，没有之前的总结）",
        new_messages=new_text,
    )

    try:
        result = await chat_completion([
            {"role": "system", "content": "你是一个精确的文本总结助手。"},
            {"role": "user", "content": prompt},
        ])

        summary.rolling_summary = result
        summary.last_summarized_index = len(branch_messages)
        summary.token_count = count_tokens(result)

        await write_json(session_id, "summary.json", summary.model_dump())
        log.info("summary_updated", session_id=session_id, token_count=summary.token_count)
    except Exception:
        log.exception("summary_failed", session_id=session_id)

    return summary


async def extract_state(session_id: str, branch_messages: list[Message]) -> StateData:
    """Extract structured state (characters, events, world) from recent messages."""
    current_state = await _load_state(session_id)

    # Only process the last 10 messages for state extraction
    recent = branch_messages[-10:]
    if not recent:
        return current_state

    new_text = "\n".join(
        f"{'用户' if m.role == 'user' else '助手'}: {m.content}"
        for m in recent
    )

    template = await _load_template("extract_state.txt")
    prompt = template.format(
        previous_state=json.dumps(current_state.model_dump(), ensure_ascii=False, indent=2),
        new_messages=new_text,
    )

    try:
        result = await chat_completion([
            {"role": "system", "content": "你是一个结构化数据提取助手。只返回JSON，不要包含任何其他文本或markdown标记。"},
            {"role": "user", "content": prompt},
        ])

        # Try to parse JSON from the result
        result = result.strip()
        if result.startswith("```"):
            lines = result.split("\n")
            result = "\n".join(lines[1:-1])

        parsed = json.loads(result)
        new_state = StateData(**parsed, version=current_state.version + 1)

        await write_json(session_id, "state.json", new_state.model_dump())
        log.info("state_extracted", session_id=session_id, version=new_state.version)
        return new_state
    except Exception:
        log.exception("state_extraction_failed", session_id=session_id)
        return current_state


async def _load_state(session_id: str) -> StateData:
    data = await read_json(session_id, "state.json")
    if data is None:
        return StateData()
    return StateData(**data)
