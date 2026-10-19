import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "web" / ".env.local")


def settings():
    own = os.getenv("LLM_API_KEY", "")
    prefix = "LLM" if own else "GLM"
    provider = os.getenv("LLM_PROVIDER", "openai") if own else "openai"
    base = os.getenv(f"{prefix}_BASE_URL") or (
        "https://api.anthropic.com" if provider == "anthropic" else
        "https://api.openai.com/v1" if own else "https://api.z.ai/api/paas/v4")
    model = os.getenv(f"{prefix}_MODEL") or (
        "claude-haiku-5-5" if provider == "anthropic" else
        "gpt-4o-mini" if own else "glm-4.7-flash")
    return {
        "key": os.getenv(f"{prefix}_API_KEY", ""), "provider": provider,
        "base": base.rstrip("/"), "model": model,
        "fallback": os.getenv(f"{prefix}_FALLBACK_MODEL", "" if own else "glm-4.5-flash"),
        "token": os.getenv("ADAPTIVE_INTERNAL_TOKEN", ""),
        "lms": os.getenv("ADAPTIVE_LMS_URL", "http://127.0.0.1:3000").rstrip("/"),
    }
