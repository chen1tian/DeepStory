import logging
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

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
    presets_dir = settings.data_dir / "presets"
    presets_dir.mkdir(parents=True, exist_ok=True)
    log.info("app_startup", data_dir=str(settings.data_dir))
    yield
    # Shutdown
    from app.services.event_bus import event_bus

    event_bus.clear()
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
from app.api.sessions import router as sessions_router  # noqa: E402
from app.api.chat import router as chat_router  # noqa: E402
from app.api.state import router as state_router  # noqa: E402
from app.api.editor import router as editor_router  # noqa: E402
from app.api.stories import router as stories_router  # noqa: E402
from app.api.ai import router as ai_router  # noqa: E402
from app.api.protagonists import router as protagonists_router  # noqa: E402
from app.api.presets import router as presets_router  # noqa: E402
from app.api.debug import router as debug_router  # noqa: E402
from app.api.characters import router as characters_router  # noqa: E402

app.include_router(sessions_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(state_router, prefix="/api")
app.include_router(editor_router, prefix="/api")
app.include_router(stories_router, prefix="/api")
app.include_router(ai_router, prefix="/api")
app.include_router(protagonists_router, prefix="/api")
app.include_router(presets_router, prefix="/api")
app.include_router(debug_router, prefix="/api")
app.include_router(characters_router, prefix="/api")

# WebSocket route (no /api prefix)
from app.api.chat import ws_router  # noqa: E402

app.include_router(ws_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
