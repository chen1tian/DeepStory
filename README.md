# 聊天创作应用

基于 FastAPI + React 的 AI 辅助创作工具。支持多轮流式聊天、Token 预算管理、对话分支、增量总结、状态提取、可定制聊天界面。

## 环境要求

- Python 3.10+
- Node.js 18+

## 快速启动

### 1. 配置环境变量

```bash
cd backend
cp .env.example .env
```

编辑 `backend/.env`，填入你的 LLM API 密钥：

```env
API_KEY=your-api-key-here
API_BASE_URL=https://api.openai.com/v1
MODEL_NAME=gpt-4o-mini
```

### 2. 启动后端

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

后端运行在 http://127.0.0.1:8001，健康检查：http://127.0.0.1:8001/api/health

### 3. 启动前端

```bash
cd frontend
npm install
npx vite --host 127.0.0.1
```

前端运行在 http://127.0.0.1:3000，已配置代理自动转发 `/api` 和 `/ws` 到后端。

### 4. 使用

浏览器打开 http://127.0.0.1:3000，点击「+ 新建」创建对话即可开始创作。

## 项目结构

```
backend/
  app/
    api/          # REST + WebSocket 端点
    services/     # 核心业务逻辑（LLM、总结、状态提取）
    models/       # Pydantic 数据模型
    storage/      # JSON 文件存储
  prompts/        # 提示词模板（可编辑）
  data/sessions/  # 运行时会话数据

frontend/
  src/
    components/   # React UI 组件
    stores/       # zustand 状态管理
    services/     # API 客户端 + WebSocket 客户端
    types/        # TypeScript 类型定义
    styles/       # 全局样式
```