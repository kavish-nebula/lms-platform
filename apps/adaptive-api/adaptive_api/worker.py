"""python -m adaptive_api.worker; restart safely, jobs survive in the LMS database."""
import logging
import threading
import time
import httpx
from .config import settings
from .pipeline import generate

log = logging.getLogger("adaptive-worker")


def run_once(client, generate_fn=generate, lane="all"):
    response = client.post("claim", json={"lane": lane})
    response.raise_for_status()
    job = response.json()["job"]
    if not job:
        return False
    identity = {"id": job["id"], "lease": job["lease"]}
    stop = threading.Event()

    def renew():
        while not stop.wait(15):
            try:
                client.post("heartbeat", json=identity).raise_for_status()
            except httpx.HTTPError:
                log.warning("Job heartbeat failed; stale results will be rejected")

    thread = threading.Thread(target=renew, daemon=True)
    thread.start()
    try:
        result = generate_fn(job)
        client.post("result", json={**identity, **result}).raise_for_status()
        log.info("Revision ready: %s", job["id"])
    except Exception as exc:
        # Provider replies may contain sensitive text; log only the exception type.
        log.warning("Job %s failed (%s)", job["id"], type(exc).__name__)
        try:
            client.post("failure", json=identity).raise_for_status()
        except httpx.HTTPError:
            log.warning("Failure receipt unavailable; lease recovery will retry")
    finally:
        stop.set()
        thread.join(timeout=1)
    return True


def main():
    logging.basicConfig(level=logging.INFO)
    c = settings()
    if len(c["token"]) < 24:
        raise SystemExit("Set ADAPTIVE_INTERNAL_TOKEN to at least 24 random characters")
    import os
    def remote_generate(job):
        response = httpx.post(os.getenv("ADAPTIVE_API_URL", "http://127.0.0.1:8001") + "/v1/generate", headers={
            "Authorization": "Bearer " + c["token"]}, json={"input": job["input"]}, timeout=120)
        response.raise_for_status()
        return response.json()
    def lane_loop(lane):
        with httpx.Client(base_url=c["lms"] + "/api/internal/adaptation/", headers={
            "Authorization": "Bearer " + c["token"]}, timeout=600) as client:
            while True:
                try:
                    if not run_once(client, remote_generate, lane):
                        time.sleep(1)
                except httpx.HTTPError:
                    log.warning("LMS unavailable; retrying in five seconds")
                    time.sleep(5)
    # Reserve capacity for the playing slide instead of queueing it behind a module.
    if os.getenv("ADAPTIVE_BACKGROUND_ENABLED", "true").lower() != "false":
        threading.Thread(target=lane_loop, args=("background",), daemon=True).start()
    lane_loop("interactive")


if __name__ == "__main__":
    main()
