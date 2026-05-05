from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.chat_manager import (
    load_session,
    get_branch_messages,
    load_summary,
    load_state,
)
from app.storage.user_protagonist_storage import load_user_protagonist

router = APIRouter(tags=["debug"])


class DebugPromptRequest(BaseModel):
    user_input: str = "（调试预览，无实际输入）"


class DebugMessage(BaseModel):
    role: str
    content: str
    token_estimate: int = 0


class DebugPromptResponse(BaseModel):
    messages: list[DebugMessage]
    budget: dict
    total_messages: int
    system_prompt: str
    summary: str
    state_text: str


@router.post("/debug/{session_id}/prompt", response_model=DebugPromptResponse)
async def debug_prompt(session_id: str, req: DebugPromptRequest):
    """Preview the full messages array that would be sent to the LLM.

    Uses the same build_prompt function as the real chat flow so both
    paths are always in sync (narrator directives, token budget, etc.).
    """
    session = await load_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    branch_msgs = await get_branch_messages(session_id)
    summary = await load_summary(session_id)
    state = await load_state(session_id)

    # Load user protagonist for prompt injection
    user_protagonist = None
    if session.user_protagonist_id:
        user_protagonist = await load_user_protagonist(session.user_protagonist_id)

    # Read narrator directives WITHOUT consuming (read-only preview)
    from app.services.narrator_service import get_prompt_directives, load_arc
    narrator_directives = None
    arc = await load_arc(session_id)
    if arc and arc.enabled:
        prompt_directives = get_prompt_directives(arc)
        if prompt_directives:
            narrator_directives = prompt_directives

    # Use the same build_prompt as the real chat flow (chat.py → tools.py)
    from app.agents.tools import build_prompt
    prompt_result = await build_prompt(
        system_prompt=session.system_prompt or "",
        state=state.model_dump() if state else None,
        summary=summary.model_dump() if summary else None,
        recent_messages=[m.model_dump() for m in branch_msgs],
        user_input=req.user_input,
        characters=[c.model_dump() for c in session.characters] if session.characters else [],
        user_protagonist=user_protagonist.model_dump() if user_protagonist and hasattr(user_protagonist, 'model_dump') else user_protagonist,
        narrator_directives=narrator_directives,
    )

    debug_messages = []
    for m in prompt_result["messages"]:
        content = m.get("content", "")
        debug_messages.append(DebugMessage(
            role=m.get("role", ""),
            content=content,
            token_estimate=len(content) // 2,
        ))

    return DebugPromptResponse(
        messages=debug_messages,
        budget=prompt_result["budget_info"],
        total_messages=len(prompt_result["messages"]),
        system_prompt=session.system_prompt or "",
        summary=summary.rolling_summary if summary else "",
        state_text=str(state.model_dump()) if state else "",
    )
