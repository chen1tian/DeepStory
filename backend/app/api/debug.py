from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.chat_manager import (
    load_session,
    get_branch_messages,
    load_summary,
    load_state,
)
from app.services.prompt_builder import build_chat_messages

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
    """Preview the full messages array that would be sent to the LLM."""
    session = await load_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    branch_msgs = await get_branch_messages(session_id)
    summary = await load_summary(session_id)
    state = await load_state(session_id)

    messages, budget_info = await build_chat_messages(
        system_prompt=session.system_prompt,
        state=state,
        summary=summary,
        recent_messages=branch_msgs,
        user_input=req.user_input,
    )

    debug_messages = []
    for m in messages:
        content = m.get("content", "")
        debug_messages.append(DebugMessage(
            role=m.get("role", ""),
            content=content,
            token_estimate=len(content) // 2,  # rough estimate
        ))

    return DebugPromptResponse(
        messages=debug_messages,
        budget=budget_info,
        total_messages=len(messages),
        system_prompt=session.system_prompt or "",
        summary=summary.rolling_summary or "",
        state_text=str(state.model_dump()) if state else "",
    )
