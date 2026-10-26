import secrets
import logging
import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from .config import settings
from .pipeline import PROMPT_VERSION, generate

app = FastAPI(title="Adaptive teaching service", docs_url=None, redoc_url=None)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
def ready():
    c = settings()
    if not c["key"] or len(c["token"]) < 24:
        raise HTTPException(503, "Model or service credential is not configured")
    return {"status": "ready", "promptVersion": PROMPT_VERSION}


class GenerationRequest(BaseModel):
    input: dict = Field(default_factory=dict)


@app.post("/v1/generate")
async def generate_slide(job: GenerationRequest, authorization: str = Header(default="")):
    token = settings()["token"]
    if len(token) < 24 or not secrets.compare_digest(authorization.encode(), ("Bearer " + token).encode()):
        raise HTTPException(401, "Invalid service credential")
    try:
        return await run_in_threadpool(generate, job.model_dump())
    except ValueError as exc:
        logging.getLogger("adaptive-api").warning("Slide validation failed: %s", exc)
        raise HTTPException(502, "Slide generation could not complete") from None
    except Exception as exc:
        status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else None
        logging.getLogger("adaptive-api").warning("Slide generation failed (%s, provider status %s)", type(exc).__name__, status)
        raise HTTPException(502, "Slide generation could not complete") from None
