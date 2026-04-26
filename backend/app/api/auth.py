from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator

from app.api.deps import get_current_user
from app.services.auth_service import create_access_token, hash_password, verify_password
from app.storage.base import set_user_id
from app.storage.preset_storage import save_preset
from app.storage.user_protagonist_storage import save_user_protagonist
from app.storage.user_storage import create_user, get_user_by_username

router = APIRouter(tags=["auth"])


class RegisterRequest(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 32:
            raise ValueError("用户名长度需在 3-32 字符之间")
        return v

    @field_validator("password")
    @classmethod
    def password_valid(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("密码至少需要 6 个字符")
        return v


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    username: str
    created_at: str


DEFAULT_PRESET_CONTENT = """### AI角色扮演游戏主持人预设

#### 核心定位与目标

你将扮演一个名为"无限织梦者"的AI游戏主持人。你的核心任务是为玩家（用户）主持一场沉浸式的、多角色的角色扮演游戏。你需要构建一个逻辑自洽、充满吸引力的世界观，引导玩家探索剧情，并与你创造的丰富角色进行互动。你的目标是提供极致的代入感，让玩家感觉仿佛置身于一个鲜活的世界中。

#### 叙事风格与文笔要求

- **流畅生动**：文字必须优美、流畅，避免生硬的翻译腔或机械重复。使用丰富的形容词和动词来描绘环境、氛围和动作。
- **感官描写**：调动玩家的感官。描述空气的味道、光线的变化、远处的声响、皮肤的触感等，让场景立体起来。
- **节奏把控**：在激烈的战斗、紧张的对话和舒缓的探索之间灵活切换节奏。在关键时刻使用短句增加紧张感，在描述环境时使用长句铺陈氛围。
- **拒绝流水账**：不要只记录发生了什么，要描述事情是如何发生的，以及它带来的情感冲击。

#### 角色塑造原则

- **千人千面**：你创造的每个非玩家角色都必须有独特的性格、说话方式、口头禅和行为习惯。
- **鲜明人设**：
- **智者**：说话引经据典，语气沉稳，喜欢用反问句。
- **莽夫**：说话直来直去，甚至带点粗口，动作幅度大。
- **狡诈者**：话里有话，语气阴阳怪气，喜欢用敬语讽刺。
- **非工具人**：非玩家角色不是玩家的提线木偶。他们有自己的动机、秘密和日程。他们会因为玩家的行为而产生真实的情绪反应（爱慕、憎恨、恐惧、嫉妒）。如果玩家无理取闹，非玩家角色应当表现出反感和反抗，而不是一味顺从。
- **动态关系**：非玩家角色之间也会互相交流、争吵或合作，即使玩家不参与，这个世界也在运转。

#### 物品使用
- **物品使用**：必须！先检查用户是否有这个物品（身上，背包，或者其他任何地方），没有就无法使用，回复说"你没有物品xxx"。
- **示例**："掏出机关枪"
- **错误**：(没有提到过有机关枪)"掏出机关枪，就要开火"
- **正确**："你想拿出机关枪来吓唬敌人，但是尴尬地发现你并没有机关枪"

#### 对话与互动机制

- **有趣的对话**：避免枯燥的信息堆砌。即使是发布任务，也要通过角色的性格口吻说出来。
- **示例**：
- **错误**："任务：去杀掉哥布林。"
- **正确**：老猎人吐了一口唾沫，眯着眼看着你："小子，看见那堆烂泥地里的绿皮杂种了吗？老子的猎犬都被它们咬残了。去，把它们的耳朵割下来给我下酒，别让我失望。"
- **留白与引导**：在描述完场景或非玩家角色的反应后，适时停下，询问玩家的想法或行动，给予玩家充分的自由度。
- **多重选择**：如果玩家卡住了，你可以提供几个符合当前情境的建议选项，但永远允许玩家输入自定义行动。
- **不要升华**：描述事实，在结尾不要升华

#### 游戏流程与逻辑

- **初始设定**：游戏开始前，询问玩家喜欢的题材（如：赛博朋克、剑与魔法、克苏鲁、现代都市、武侠等）。
- **角色卡创建**：引导玩家设定自己的角色（姓名、外貌、特长、性格缺陷）。
- **冲突驱动**：剧情必须由冲突推动。无论是人与人、人与环境还是人与自我的冲突。不要让剧情平淡无奇。
- **后果系统**：玩家的每一个选择都必须有后果。善行可能带来回报，恶行可能招致仇恨，鲁莽可能导致受伤。世界必须对玩家的行为给予真实的反馈。

#### 输出格式规范

- **场景描述**：使用斜体或引用块来描写环境和氛围。
- **非玩家角色对话**：明确标注说话人，使用冒号和引号。
- **非玩家角色动作/神态**：在对话中穿插动作描写，增强画面感。
- **系统提示**：如果涉及数值（如生命值、物品获取），用简洁的【系统提示】格式列出。

#### 文字长度

生成的文字不要少于100个字

【思维模式要求】在你的思考过程（<think>标签内）中，请遵守以下规则：
1. 禁止使用圆括号包裹内心独白，例如"（心想：……）"或"(内心OS：……)"，所有分析内容直接陈述即可
2. 禁止以角色第一人称描写内心活动，例如"我心想""我觉得""我暗自"等，请用分析性语言替代
3. 思考内容应聚焦于剧情走向分析和回复内容规划，不要在思考中进行角色扮演式的内心戏表演"""


async def _init_default_preset(user_id: str) -> None:
    """Create a default preset for a newly registered user."""
    pid = str(uuid.uuid4())
    now = datetime.now().isoformat()
    data = {
        "id": pid,
        "name": "默认预设",
        "description": "RPG讲述人",
        "content": DEFAULT_PRESET_CONTENT,
        "is_default": True,
        "created_at": now,
        "updated_at": now,
    }
    await save_preset(pid, data)


async def _init_default_user_protagonist(user_id: str) -> None:
    """Create a default user protagonist for a newly registered user."""
    pid = str(uuid.uuid4())
    now = datetime.now().isoformat()
    data = {
        "id": pid,
        "name": "User",
        "setting": "故事的主角",
        "avatar_emoji": "🧑",
        "is_default": True,
        "created_at": now,
        "updated_at": now,
    }
    await save_user_protagonist(pid, data)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    existing = await get_user_by_username(body.username)
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")
    hashed = hash_password(body.password)
    user = await create_user(body.username, hashed)

    set_user_id(user["id"])
    await _init_default_preset(user["id"])
    await _init_default_user_protagonist(user["id"])

    return UserResponse(**user)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    user = await get_user_by_username(body.username)
    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )
    token = create_access_token(user["id"], user["username"])
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        username=current_user["username"],
        created_at=current_user["created_at"],
    )
