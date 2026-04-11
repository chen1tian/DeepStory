from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.schemas import EditorGenerateRequest
from app.services.llm_service import chat_completion
from app.storage.file_storage import read_text, write_text

router = APIRouter(tags=["editor"])

# Built-in templates
TEMPLATES = {
    "bubble": """<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; background: var(--bg, #1a1a2e); color: var(--text, #eee); padding: 16px; }
  .message { max-width: 80%; margin: 8px 0; padding: 12px 16px; border-radius: 18px; line-height: 1.6; animation: fadeIn 0.3s; }
  .user { background: var(--user-bg, #0f3460); margin-left: auto; border-bottom-right-radius: 4px; }
  .assistant { background: var(--assistant-bg, #16213e); margin-right: auto; border-bottom-left-radius: 4px; }
  .meta { font-size: 0.75em; opacity: 0.6; margin-top: 4px; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>
</head>
<body>
<div id="messages"></div>
<script>
  window.addEventListener('message', (e) => {
    if (e.data.type === 'update_messages') {
      const container = document.getElementById('messages');
      container.innerHTML = '';
      e.data.messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'message ' + msg.role;
        div.textContent = msg.content;
        container.appendChild(div);
      });
    }
  });
</script>
</body>
</html>""",
    "card": """<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', serif; background: var(--bg, #f5f0e8); color: var(--text, #333); padding: 20px; }
  .message { background: var(--card-bg, #fff); border: 1px solid #ddd; border-radius: 8px; padding: 16px 20px; margin: 12px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); line-height: 1.8; }
  .message .role { font-size: 0.8em; font-weight: bold; color: var(--accent, #8b4513); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }
  .user .role { color: var(--user-accent, #2c5282); }
</style>
</head>
<body>
<div id="messages"></div>
<script>
  window.addEventListener('message', (e) => {
    if (e.data.type === 'update_messages') {
      const container = document.getElementById('messages');
      container.innerHTML = '';
      e.data.messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'message ' + msg.role;
        div.innerHTML = '<div class="role">' + (msg.role === 'user' ? '你' : '叙述者') + '</div>' + msg.content;
        container.appendChild(div);
      });
    }
  });
</script>
</body>
</html>""",
    "rpg": """<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; background: var(--bg, #0d0d0d); color: var(--text, #00ff41); padding: 16px; }
  .message { padding: 8px 0; border-bottom: 1px solid #1a3a1a; line-height: 1.6; }
  .user::before { content: '> '; color: var(--user-color, #ffcc00); font-weight: bold; }
  .assistant::before { content: '⚔ '; color: var(--npc-color, #00ff41); }
  .status-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #111; padding: 8px 16px; border-top: 2px solid #00ff41; font-size: 0.85em; display: flex; gap: 20px; }
  .stat { color: #aaa; }
  .stat span { color: #00ff41; }
</style>
</head>
<body>
<div id="messages"></div>
<div class="status-bar" id="status"></div>
<script>
  window.addEventListener('message', (e) => {
    if (e.data.type === 'update_messages') {
      const container = document.getElementById('messages');
      container.innerHTML = '';
      e.data.messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'message ' + msg.role;
        div.textContent = msg.content;
        container.appendChild(div);
      });
    }
    if (e.data.type === 'update_state') {
      const bar = document.getElementById('status');
      const s = e.data.state;
      bar.innerHTML = '';
      if (s.world_state) {
        bar.innerHTML = '<span class="stat">位置: <span>' + (s.world_state.location || '未知') + '</span></span>' +
          '<span class="stat">时间: <span>' + (s.world_state.time || '未知') + '</span></span>' +
          '<span class="stat">氛围: <span>' + (s.world_state.atmosphere || '未知') + '</span></span>';
      }
    }
  });
</script>
</body>
</html>""",
}


@router.post("/editor/{session_id}/generate")
async def generate_ui(session_id: str, req: EditorGenerateRequest):
    base_template = TEMPLATES.get(req.template, TEMPLATES["bubble"])

    prompt = f"""你是一个前端开发专家。用户想要定制一个聊天界面。

## 基础模板
```html
{base_template}
```

## 用户需求
{req.description}

## 要求
1. 基于上面的模板进行修改
2. 保留 postMessage 事件监听机制（这是数据通信方式）
3. 必须保留 id="messages" 的容器
4. 可以自由修改样式、添加动画、改变布局
5. 使用 CSS 变量方便主题切换
6. 保持代码简洁，返回完整的 HTML 文件
7. 只返回 HTML 代码，不要包含任何解释文字或 markdown 标记"""

    html = await chat_completion([
        {"role": "system", "content": "你是一个专业的前端开发专家，只输出纯HTML代码。"},
        {"role": "user", "content": prompt},
    ], connection_id=req.connection_id)

    # Clean up potential markdown wrapping
    html = html.strip()
    if html.startswith("```"):
        lines = html.split("\n")
        html = "\n".join(lines[1:-1])

    return {"html": html}


@router.get("/editor/{session_id}/ui")
async def get_custom_ui(session_id: str):
    html = await read_text(session_id, "custom_ui.html")
    if html is None:
        # Return default template
        return {"html": TEMPLATES["bubble"], "is_default": True}
    return {"html": html, "is_default": False}


@router.put("/editor/{session_id}/ui")
async def save_custom_ui(session_id: str, body: dict):
    html = body.get("html", "")
    if not html:
        raise HTTPException(status_code=400, detail="HTML content required")
    await write_text(session_id, "custom_ui.html", html)
    return {"status": "saved"}


@router.get("/editor/templates")
async def get_templates():
    return {
        "templates": [
            {"id": "bubble", "name": "简约气泡", "description": "现代暗色气泡对话风格"},
            {"id": "card", "name": "卡片流", "description": "典雅卡片式对话布局"},
            {"id": "rpg", "name": "RPG 对话框", "description": "复古终端风格，带状态栏"},
        ]
    }
