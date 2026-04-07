from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # LLM
    api_key: str = "sk-change-me"
    api_base_url: str = "https://api.openai.com/v1"
    model_name: str = "gpt-4o-mini"

    # Context window
    max_context_tokens: int = 8192
    reply_reserve_tokens: int = 1024
    summary_max_tokens: int = 2000
    state_max_tokens: int = 1000

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Paths
    data_dir: Path = Path(__file__).resolve().parent.parent / "data"
    prompts_dir: Path = Path(__file__).resolve().parent.parent / "prompts"

    # WebSocket
    ws_heartbeat_interval: int = 30

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "protected_namespaces": ("settings_",)}


settings = Settings()
