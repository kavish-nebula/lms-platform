import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "web" / ".env.local")


def settings(provider_override=None):
    if (provider_override or os.getenv('LLM_PROVIDER', '')).strip().lower() == 'vertex':
        project = os.getenv('GOOGLE_CLOUD_PROJECT', '').strip()
        location = os.getenv('GOOGLE_CLOUD_LOCATION', 'us-central1').strip()
        import re
        if not re.fullmatch(r'[a-z][a-z0-9-]{4,61}[a-z0-9]', project) or not re.fullmatch(r'[a-z0-9-]+', location):
            raise ValueError('Configure GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION')
        host = 'aiplatform.googleapis.com' if location == 'global' else f'{location}-aiplatform.googleapis.com'
        return {'key': '', 'provider': 'vertex', 'base': f'https://{host}/v1/projects/{project}/locations/{location}/endpoints/openapi',
                'model': os.getenv('LLM_MODEL') or 'gemini-3.5-flash-lite', 'fallback': os.getenv('LLM_FALLBACK_MODEL', 'none'),
                'token': os.getenv('ADAPTIVE_INTERNAL_TOKEN', ''), 'lms': os.getenv('ADAPTIVE_LMS_URL', 'http://127.0.0.1:3000').rstrip('/')}
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


def vertex_access_token():
    # google-auth caches credentials and refreshes before expiry, rather than
    # treating a one-hour access token as a permanent API key.
    import google.auth
    from google.auth.transport.requests import Request
    global _credentials
    try:
        if _credentials is None:
            _credentials, _ = google.auth.default(scopes=['https://www.googleapis.com/auth/cloud-platform'])
        if not _credentials.valid:
            _credentials.refresh(Request())
        return _credentials.token
    except Exception:
        raise ValueError('Vertex authentication failed; configure Google Application Default Credentials') from None


_credentials = None
