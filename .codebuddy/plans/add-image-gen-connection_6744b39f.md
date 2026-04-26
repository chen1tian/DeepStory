---
name: add-image-gen-connection
overview: 在现有连接系统中新增"文生图"连接类型，支持豆包(Volcengine)和百度千帆两种provider的配置，实现连接的创建、编辑、展示和API测试通过。仅做连接配置层，不涉及应用层功能。
design:
  architecture:
    framework: react
  styleKeywords:
    - Glassmorphism
    - Dark-mode
    - Consistent with existing UI
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 14px
      weight: 600
    subheading:
      size: 13px
      weight: 500
    body:
      size: 13px
      weight: 400
  colorSystem:
    primary:
      - "#6366F1"
      - "#8B5CF6"
    background:
      - "#1E1E2E"
      - "#2A2A3C"
    text:
      - "#E2E8F0"
      - "#94A3B8"
    functional:
      - "#22C55E"
      - "#EF4444"
      - "#F59E0B"
todos:
  - id: backend-schema
    content: 扩展Connection Schema，添加connection_type、image_gen_config字段和ConnectionType枚举
    status: completed
  - id: backend-service
    content: 新建image_gen_service.py，实现豆包和千帆的API测试逻辑
    status: completed
    dependencies:
      - backend-schema
  - id: backend-api
    content: 修改connections.py路由，新增测试端点；修改llm_service.py过滤非LLM连接；添加httpx依赖
    status: completed
    dependencies:
      - backend-service
  - id: frontend-types
    content: 扩展前端Connection类型定义，新增ConnectionType和ImageGenConfig
    status: completed
  - id: frontend-manager
    content: 改造ConnectionManager组件，按类型动态渲染表单，新增测试按钮和预设模板
    status: completed
    dependencies:
      - frontend-types
  - id: frontend-switcher-api
    content: 改造ConnectionSwitcher区分类型图标，api.ts新增testConnection，connectionStore新增test action
    status: completed
    dependencies:
      - frontend-types
---

## 产品概述

在现有连接管理系统中新增"文生图"连接类型，支持配置和API连通性测试。

## 核心功能

- 在Connection数据模型中新增 `connection_type` 字段，区分 "llm" 和 "image_generation" 两种连接类型
- 文生图连接配置字段：api_key、api_base_url、model_name（模型ID）、image_size、n（生成数量）
- 连接管理界面根据 connection_type 动态渲染不同的配置表单
- 连接列表和切换器中用图标/标签区分连接类型
- 新增"测试连接"功能：验证API Key和endpoint是否可用
- 首批支持豆包（Volcengine）和百度千帆两种文生图API的测试逻辑
- 向后兼容：旧连接数据默认 connection_type="llm"

## 技术栈

- 后端: FastAPI + Pydantic + httpx（用于文生图API测试调用）
- 前端: React + TypeScript + Tailwind CSS
- 存储: JSON文件存储（复用现有 connection_storage.py）

## 实现方案

### 核心策略

在现有Connection模型上扩展 `connection_type` 字段和文生图专属配置字段，通过类型区分渲染不同表单和执行不同测试逻辑。后端新增 `image_gen_service.py` 负责文生图API调用和测试，前端 `ConnectionManager.tsx` 根据类型动态切换表单。

### 向后兼容

- Connection模型新增 `connection_type` 字段，默认值为 `"llm"`
- 旧JSON数据文件读取时自动填充默认值（Pydantic自带机制）
- `llm_service.py` 的 `get_client_and_model()` 仅处理 `connection_type="llm"` 的连接，忽略文生图连接
- `connection_storage.py` 的默认连接创建逻辑不变（仍创建LLM类型）

### API测试逻辑

- **豆包(Volcengine)**: 使用 httpx 调用 Volcengine API，通过签名认证发送文生图请求（使用最小参数，仅验证连通性）
- **百度千帆**: 使用 httpx 调用千帆文生图API，通过 Bearer token 认证发送请求
- 测试端点返回成功/失败状态及错误信息，不实际生成和保存图片

### 关键设计决策

1. 使用 `httpx` 而非 `requests`：异步非阻塞，与项目FastAPI异步风格一致
2. 文生图配置字段使用 `extra_config: dict` 存储而非独立字段：不同API厂商参数差异大，dict更灵活
3. 测试连接使用同步小请求（超时10秒），不执行完整生图流程

## 目录结构

```
h:\Dev\Temp\DeepDemo1\
├── backend/
│   ├── app/
│   │   ├── models/
│   │   │   └── schemas.py                    # [MODIFY] 扩展Connection模型，添加connection_type和extra_config字段
│   │   ├── api/
│   │   │   └── connections.py                # [MODIFY] 新增 POST /connections/{id}/test 测试端点
│   │   ├── services/
│   │   │   ├── llm_service.py                # [MODIFY] get_client_and_model() 过滤非LLM类型连接
│   │   │   └── image_gen_service.py          # [NEW] 文生图API调用服务，含豆包和千帆测试逻辑
│   │   └── storage/
│   │       └── connection_storage.py         # [MODIFY] 默认连接创建适配新字段
│   └── requirements.txt                      # [MODIFY] 添加 httpx 依赖
├── frontend/
│   └── src/
│       ├── types/
│       │   └── index.ts                      # [MODIFY] 扩展Connection类型，新增ConnectionType枚举
│       ├── components/
│       │   ├── ConnectionManager.tsx          # [MODIFY] 根据connection_type动态渲染表单，新增测试按钮
│       │   └── ConnectionSwitcher.tsx         # [MODIFY] 列表中区分连接类型图标
│       ├── stores/
│       │   └── connectionStore.ts             # [MODIFY] 新增testConnection action
│       └── services/
│           └── api.ts                         # [MODIFY] 新增testConnection API调用
```

## 关键代码结构

### Connection Schema 扩展 (schemas.py)

```python
class ConnectionType(str, Enum):
    LLM = "llm"
    IMAGE_GENERATION = "image_generation"

class ImageGenConfig(BaseModel):
    image_size: str = "1024x1024"
    n: int = 1
    # 其他厂商特有参数由extra_config承载

class Connection(BaseModel):
    id: str
    name: str = "未命名连接"
    connection_type: ConnectionType = ConnectionType.LLM
    api_key: str = ""
    api_base_url: str = ""
    model_name: str = "gpt-4o-mini"
    is_default: bool = False
    image_gen_config: ImageGenConfig | None = None
    created_at: str = ...
    updated_at: str = ...
```

### 前端 Connection 类型扩展 (index.ts)

```typescript
export type ConnectionType = "llm" | "image_generation";

export interface ImageGenConfig {
  image_size: string;
  n: number;
}

export interface Connection {
  id: string;
  name: string;
  connection_type: ConnectionType;
  api_key: string;
  api_base_url: string;
  model_name: string;
  is_default: boolean;
  image_gen_config: ImageGenConfig | null;
  created_at: string;
  updated_at: string;
}
```

### image_gen_service.py 核心接口

```python
async def test_connection(connection_data: dict) -> dict:
    """测试文生图连接是否可用，返回 {success: bool, message: str}"""

async def _test_volcengine(api_key: str, api_base_url: str, model_name: str) -> dict:
    """测试豆包/Volcengine文生图API"""

async def _test_qianfan(api_key: str, api_base_url: str, model_name: str) -> dict:
    """测试百度千帆文生图API"""
```

## 设计方案

在现有连接管理弹窗基础上，通过 connection_type 选择器动态切换表单内容。

### 连接管理弹窗改造

- 顶部新增"新建连接"按钮旁增加类型选择（下拉）：LLM连接 / 文生图连接
- 左栏连接列表项：LLM连接显示"🔗"图标，文生图连接显示"🎨"图标 + 类型标签
- 右栏编辑表单：根据 connection_type 渲染不同字段组

### 文生图连接表单字段

- 名称（文本输入）
- API Key（密码输入）
- API Base URL（文本输入，根据预设填充默认值）
- 模型名称（文本输入）
- 图片尺寸（下拉选择：1024x1024 / 512x512 / 768x768 等）
- 生成数量（数字输入，1-4）
- "测试连接"按钮（点击后显示成功/失败状态）

### 预设模板

新建文生图连接时提供快捷预设：

- 豆包 Volcengine：自动填充 api_base_url 和默认 model_name
- 百度千帆：自动填充 api_base_url 和默认 model_name

### 连接切换器

- 文生图连接显示 🎨 图标前缀，LLM连接显示 🔗 图标前缀
- 下拉列表中用小标签区分类型