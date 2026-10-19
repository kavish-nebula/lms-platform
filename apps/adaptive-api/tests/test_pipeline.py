import json
import os
import unittest
from unittest.mock import patch
import httpx
from fastapi.testclient import TestClient
from adaptive_api.api import app
from adaptive_api.pipeline import PROMPT_VERSION, SYSTEM, generate, validate
from adaptive_api.worker import run_once

SLIDE = {"kind": "title", "title": "Agents", "icon": "bot", "cue": 0,
         "sentences": ["An agent uses tools."], "narration": "An agent uses tools."}
JOB = {"id": "job", "lease": "lease", "input": {"authored": SLIDE, "source": SLIDE, "context": {"promptVersion": PROMPT_VERSION, "answers": {"domain": "healthcare"}}, "trigger": "simplify"}}


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"LLM_API_KEY": "test", "LLM_MODEL": "test-model", "LLM_PROVIDER": "openai", "LLM_BASE_URL": "https://model.test/v1", "LLM_FALLBACK_MODEL": "none", "ADAPTIVE_INTERNAL_TOKEN": "test-token-that-is-long-enough"})
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_shape_and_narration(self):
        changed = {**SLIDE, "kind": "code", "cue": 99, "icon": "wrong", "sentences": ["An agent can use your booking tool."], "narration": "Mismatched"}
        result = validate(SLIDE, changed)
        self.assertEqual(result["kind"], "title")
        self.assertEqual(result["cue"], 0)
        self.assertEqual(result["narration"], " ".join(result["sentences"]))
        with self.assertRaises(ValueError):
            validate(SLIDE, {**SLIDE, "sentences": []})
        with self.assertRaises(ValueError):
            validate(SLIDE, {**SLIDE, "title": "x" * 500})

    def test_complete_ild_prompt_and_experience_for_all_triggers(self):
        import copy
        headings = ["AUTHORITY AND INPUTS", "INSTRUCTIONAL DESIGN PROCESS", "MODULE 1: PROFILE AND ENROLLMENT PERSONALISATION", "LATER MODULES: PERFORMANCE-DRIVEN ADAPTATION", "TRIGGER-SPECIFIC BEHAVIOUR", "SLIDES, NARRATION, AND ACCESSIBILITY", "STRUCTURAL AND TECHNICAL CONSTRAINTS", "QUALITY GATES AND FALLBACK"]
        for trigger in ["initial", "simplify", "example", "wrong_answer"]:
            with self.subTest(trigger=trigger):
                job = copy.deepcopy(JOB)
                job["input"]["trigger"] = trigger
                job["input"]["context"]["profile"] = {"experience": "never", "coding": "none", "style": "steps"}
                job["input"]["context"]["answers"]["experience"] = "little"
                calls = []
                def model(req):
                    calls.append(json.loads(req.content))
                    slide = {**SLIDE, "title": "Healthcare agents", "sentences": ["Healthcare agents use tools."]}
                    return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(slide)}}]})
                with httpx.Client(transport=httpx.MockTransport(model)) as client:
                    result = generate(job, client)
                system = calls[0]["messages"][0]["content"]
                self.assertEqual(system, SYSTEM)
                for i, heading in enumerate(headings, 1):
                    self.assertIn(f"{i}. {heading}", system)
                supplied = json.loads(calls[0]["messages"][1]["content"])
                self.assertEqual(supplied["TRIGGER"], trigger)
                self.assertEqual(supplied["LEARNER_FOCUS"]["experience"], "little")
                self.assertEqual(supplied["LEARNER_FOCUS"]["coding"], "none")
                self.assertEqual(result["content"]["narration"], " ".join(result["content"]["sentences"]))

    def test_outdated_prompt_snapshot_never_calls_provider(self):
        import copy
        job = copy.deepcopy(JOB)
        job["input"]["context"]["promptVersion"] = 3
        with patch("adaptive_api.pipeline.call_model") as model:
            with self.assertRaisesRegex(ValueError, "prompt version"):
                generate(job)
            model.assert_not_called()

    def test_generation_repair_and_profile(self):
        calls = []
        def model(req):
            calls.append(json.loads(req.content))
            content = "invalid" if len(calls) == 1 else json.dumps(SLIDE)
            return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})
        with httpx.Client(transport=httpx.MockTransport(model)) as client:
            result = generate(JOB, client)
        self.assertEqual(len(calls), 2)
        self.assertIn("healthcare", calls[0]["messages"][1]["content"])
        self.assertEqual(result["content"]["narration"], SLIDE["narration"])

    def test_provider_failure_is_bounded(self):
        calls = []
        def failure(req):
            calls.append(req)
            return httpx.Response(429, json={"error": "busy"})
        with httpx.Client(transport=httpx.MockTransport(failure)) as client:
            with self.assertRaises(httpx.HTTPStatusError):
                generate(JOB, client)
        self.assertEqual(len(calls), 2)

    def test_example_requires_the_learners_field(self):
        import copy
        job = copy.deepcopy(JOB)
        job["input"]["trigger"] = "example"
        job["input"]["context"]["answers"] = {"domain": "student", "studyFieldOther": "biomedical engineering"}
        job["input"]["context"]["plan"] = {"modules": [{"moduleId": "m1", "hookScene": "An unrelated maritime shop"}]}
        calls = []
        def model(req):
            calls.append(json.loads(req.content))
            content = SLIDE if len(calls) == 1 else {**SLIDE, "title": "Biomedical agents", "sentences": ["Biomedical lab tools can help."]}
            return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(content)}}]})
        with httpx.Client(transport=httpx.MockTransport(model)) as client:
            result = generate(job, client)
        self.assertEqual(len(calls), 2)
        self.assertIn("Biomedical", result["content"]["narration"])
        self.assertNotIn("maritime shop", calls[0]["messages"][1]["content"])

    def test_performance_evidence_requires_visible_and_spoken_bridge(self):
        import copy
        job = copy.deepcopy(JOB)
        job["input"]["trigger"] = "initial"
        job["input"]["context"]["prerequisiteTeaching"] = [{"lessonId": "1.1", "title": "Agents", "keyIdeas": ["Agents act through tools."]}]
        calls = []
        def model(req):
            calls.append(json.loads(req.content))
            content = SLIDE if len(calls) == 1 else {**SLIDE, "title": "Quick reminder: agents", "sentences": ["Quick reminder: tools act."]}
            return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(content)}}]})
        with httpx.Client(transport=httpx.MockTransport(model)) as client:
            result = generate(job, client)
        self.assertEqual(len(calls), 2)
        self.assertIn("Quick reminder", result["content"]["title"])
        self.assertIn("Quick reminder", result["content"]["narration"])
        self.assertIn("Agents act through tools.", calls[0]["messages"][1]["content"])
        self.assertEqual(calls[1]["messages"][-2]["role"], "assistant")

    def test_worker_receipts_and_failure(self):
        calls = []
        def lms(req):
            calls.append((req.url.path, json.loads(req.content)))
            return httpx.Response(200, json={"job": JOB} if req.url.path.endswith("claim") else {"ok": True})
        with httpx.Client(base_url="https://lms.test/", transport=httpx.MockTransport(lms)) as client:
            self.assertTrue(run_once(client, lambda job: {"content": SLIDE, "model": "stub", "metrics": {}}, "interactive"))
            self.assertEqual(calls[-1][0], "/result")
            self.assertEqual(calls[-1][1]["lease"], "lease")
            def bad(job):
                raise ValueError("broken")
            run_once(client, bad)
            self.assertEqual(calls[-1][0], "/failure")

    def test_api_auth_health_and_contract(self):
        client = TestClient(app)
        self.assertEqual(client.get("/health").status_code, 200)
        self.assertEqual(client.get("/ready").status_code, 200)
        self.assertEqual(client.post("/v1/generate", json={"input": JOB["input"]}).status_code, 401)
        with patch("adaptive_api.api.generate", return_value={"content": SLIDE, "model": "stub", "metrics": {}}):
            res = client.post("/v1/generate", json={"input": JOB["input"]}, headers={"Authorization": "Bearer test-token-that-is-long-enough"})
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["content"], SLIDE)


if __name__ == "__main__":
    unittest.main()
