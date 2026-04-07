from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.llm_service import chat_completion

router = APIRouter(tags=["ai"])


class PolishRequest(BaseModel):
    original: str
    instruction: str
    field_type: str = "text"  # "background" | "opener"


class PolishResponse(BaseModel):
    result: str


SYSTEM_PROMPTS = {
    "background": (
        "你是一位创意写作助手，专门帮助用户润色和完善故事背景设定。"
        "用户会提供原始文本和修改指令，请根据指令对文本进行润色、扩展或改写。"
        "直接输出润色后的结果，不要添加额外说明。保持中文输出。"
    ),
    "opener": (
        "你是一位创意写作助手，专门帮助用户润色和完善故事开场白。"
        "开场白应该引人入胜、有代入感，能让读者立刻沉浸到故事中。"
        "用户会提供原始文本和修改指令，请根据指令对文本进行润色、扩展或改写。"
        "直接输出润色后的结果，不要添加额外说明。保持中文输出。"
    ),
}


@router.post("/ai/polish", response_model=PolishResponse)
async def polish_text(req: PolishRequest):
    system = SYSTEM_PROMPTS.get(req.field_type, SYSTEM_PROMPTS["background"])

    user_content = ""
    if req.original.strip():
        user_content += f"原始文本：\n{req.original}\n\n"
    user_content += f"要求：{req.instruction}"

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_content},
    ]

    result = await chat_completion(messages, temperature=0.8, max_tokens=2000)
    return PolishResponse(result=result)
