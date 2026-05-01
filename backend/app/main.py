import logging
from contextlib import asynccontextmanager

import structlog
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.deps import get_current_user
from app.config import settings
from app.storage.user_storage import init_db

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    sessions_dir = settings.data_dir / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)
    stories_dir = settings.data_dir / "stories"
    stories_dir.mkdir(parents=True, exist_ok=True)
    protagonists_dir = settings.data_dir / "protagonists"
    protagonists_dir.mkdir(parents=True, exist_ok=True)
    user_protagonists_dir = settings.data_dir / "user_protagonists"
    user_protagonists_dir.mkdir(parents=True, exist_ok=True)
    presets_dir = settings.data_dir / "presets"
    presets_dir.mkdir(parents=True, exist_ok=True)
    connections_dir = settings.data_dir / "connections"
    connections_dir.mkdir(parents=True, exist_ok=True)
    hooks_dir = settings.data_dir / "hooks"
    hooks_dir.mkdir(parents=True, exist_ok=True)
    log.info("app_startup", data_dir=str(settings.data_dir))
    await init_db()
    # Initialize agent registry (no-op if deepagents not installed)
    from app.agents.registry import agent_registry

    log.info("agent_registry_initialized")
    yield
    # Shutdown
    from app.services.event_bus import event_bus

    event_bus.clear()
    agent_registry.clear()
    log.info("app_shutdown")


app = FastAPI(title="Creative Chat", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
from app.api.auth import router as auth_router  # noqa: E402
from app.api.sessions import router as sessions_router  # noqa: E402
from app.api.chat import router as chat_router  # noqa: E402
from app.api.state import router as state_router  # noqa: E402
from app.api.editor import router as editor_router  # noqa: E402
from app.api.stories import router as stories_router  # noqa: E402
from app.api.ai import router as ai_router  # noqa: E402
from app.api.protagonists import router as protagonists_router  # noqa: E402
from app.api.user_protagonists import router as user_protagonists_router  # noqa: E402
from app.api.presets import router as presets_router  # noqa: E402
from app.api.connections import router as connections_router  # noqa: E402
from app.api.debug import router as debug_router  # noqa: E402
from app.api.characters import router as characters_router  # noqa: E402
from app.api.hooks import router as hooks_router  # noqa: E402
from app.api.narrator import router as narrator_router  # noqa: E402
from app.api.rooms import router as rooms_router  # noqa: E402
from app.api.images import router as images_router  # noqa: E402
from app.api.image_gen import router as image_gen_router  # noqa: E402

app.include_router(sessions_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(chat_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(state_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(editor_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(stories_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(ai_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(protagonists_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(user_protagonists_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(presets_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(connections_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(debug_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(characters_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(hooks_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(narrator_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(rooms_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(images_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(image_gen_router, prefix="/api", dependencies=[Depends(get_current_user)])

# WebSocket route (no /api prefix)
from app.api.chat import ws_router  # noqa: E402

app.include_router(ws_router)
app.include_router(auth_router, prefix="/api/auth")

# Serve uploaded images as static files
from fastapi.staticfiles import StaticFiles  # noqa: E402

images_dir = settings.data_dir / "images"
images_dir.mkdir(parents=True, exist_ok=True)
app.mount("/api/images", StaticFiles(directory=str(images_dir)), name="images")

# Serve frontend static files in production (Docker)
if settings.static_dir and settings.static_dir.exists():
    from fastapi.responses import FileResponse  # noqa: E402

    @app.get("/")
    async def serve_index():
        return FileResponse(settings.static_dir / "index.html")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = settings.static_dir / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(settings.static_dir / "index.html")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
