import json
import os
import unittest
from unittest.mock import patch
import httpx
from fastapi.testclient import TestClient
from adaptive_api.api import app
from adaptive_api.pipeline import PROMPT_VERSION, SYSTEM, generate, output_constraints, validate, hook_text_map, apply_hook_text_map, normalize_hook_edits
from adaptive_api.worker import run_once

SLIDE = {"kind": "title", "title": "Agents", "icon": "bot", "cue": 0,
         "sentences": ["An agent uses tools."], "narration": "An agent uses tools."}
JOB = {"id": "job", "lease": "lease", "input": {"authored": SLIDE, "source": SLIDE, "context": {"promptVersion": PROMPT_VERSION, "answers": {"domain": "healthcare"}}, "trigger": "simplify"}}


class PipelineTests(unittest.TestCase):
    def test_example_repairs_event_phrase_used_as_a_goal(self):
        import copy
        job = copy.deepcopy(JOB)
        job["input"].update(trigger="example")
        job["input"]["authored"]={**SLIDE,"sentences":["Mechanical tools use a language model to take actions and answer questions."]}
        job["input"]["context"].update(answers={"domain":"mechanical"}, derived={"vocab":{"trigger":"a professor posts a lab assignment"}})
        calls=[]
        def model(req):
            calls.append(json.loads(req.content))
            sentence="Mechanical tools work toward answering a professor posts a lab assignment." if len(calls)==1 else "Mechanical tools help answer a professor's lab question."
            slide={**SLIDE,"title":"Mechanical tools","sentences":[sentence]}
            return httpx.Response(200,json={"choices":[{"message":{"content":json.dumps(slide)}}]})
        with httpx.Client(transport=httpx.MockTransport(model)) as client:
            result=generate(job,client)["content"]
        self.assertEqual(len(calls),2)
        self.assertIn("event phrase",calls[1]["messages"][-1]["content"])
        self.assertIn("professor's lab question",result["narration"])

    def test_mechanical_example_rejects_original_identifiers_and_gift_cards(self):
        import copy
        job=copy.deepcopy(JOB)
        job["input"].update(trigger="example")
        job["input"]["context"]["answers"]={"domain":"student","studyFieldOther":"mechanical engineering"}
        calls=[]
        def model(req):
            calls.append(json.loads(req.content))
            slide={**SLIDE,"title":"Mechanical gift cards" if len(calls)==1 else "Mechanical lab hours","sentences":["Mechanical order ORB-10482." if len(calls)==1 else "Mechanical lab guidance is in the manual."]}
            return httpx.Response(200,json={"choices":[{"message":{"content":json.dumps(slide)}}]})
        with httpx.Client(transport=httpx.MockTransport(model)) as client:
            result=generate(job,client)["content"]
        self.assertEqual(len(calls),2)
        self.assertIn("ORB-10482",calls[1]["messages"][-1]["content"])
        self.assertEqual(result["title"],"Mechanical lab hours")
    def test_grouped_hook_arrays_cannot_change_structure_or_protected_fields(self):
        hook = {"film": {"asks": ["One", "Two"]}, "correct": "h1"}
        edits = normalize_hook_edits(hook, {"$.film.asks": ["Shaft", "Bearing"]})
        self.assertEqual(edits, {"$.film.asks[0]": "Shaft", "$.film.asks[1]": "Bearing"})
        for malformed in [{"$.film.asks": ["One"]}, {"$.film.asks": ["One", "Two", "Three"]}, {"$.correct": "h2"}, {"$.film.asks": [{"text": "One"}, "Two"]}]:
            with self.assertRaises(ValueError):
                normalize_hook_edits(hook, malformed)

    def test_repair_keeps_valid_edits_after_unknown_path(self):
        import copy
        hook = {"title": "Orbit bot", "narration": "Orbit helps.", "film": {"asks": ["Orbit order?", "ORB-42?"]}, "correct": "h1"}
        job = copy.deepcopy(JOB)
        job["input"].update(authored=hook, source=hook, piece="hook", textMapVersion=5, courseId="ai-agent")
        job["input"]["context"]["answers"] = {"domain": "student", "studyFieldOther": "mechanical engineering"}
        calls = []
        def model(req):
            calls.append(json.loads(req.content))
            edits = {"$.title": "Harbour bot", "$.film.asks": ["Mechanical drawing?", "Shaft test?"], "$.fake": "bad"} if len(calls) == 1 else {"$.narration": "Harbour mechanical lab helps."}
            return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(edits)}}]})
        with httpx.Client(transport=httpx.MockTransport(model)) as client:
            result = generate(job, client)["content"]
        self.assertEqual(len(calls), 2)
        self.assertEqual(result["film"]["asks"], ["Mechanical drawing?", "Shaft test?"])
        self.assertEqual(result["title"], "Harbour bot")
        self.assertEqual(result["correct"], "h1")

    def test_hook_scenario_repairs_generic_title_and_implausible_actions(self):
        import copy
        hook = {"title": "The chatbot that apologised", "narration": "Orbit cannot access the report.", "film": {"say": "Orbit cannot find it."}, "correct": "h1"}
        for initial in [{"$.title": "A chatbot problem", "$.film.say": "Mechanical prototype test results are unavailable."}, {"$.title": "Mechanical prototype tests", "$.film.say": "Has my mechanical calculation shipped?"}]:
            with self.subTest(initial=initial):
                job = copy.deepcopy(JOB)
                job["input"].update(authored=hook, source=hook, piece="hook", textMapVersion=6, courseId="ai-agent")
                job["input"]["context"]["answers"] = {"domain": "student", "studyFieldOther": "mechanical engineering"}
                calls = []
                def model(req):
                    calls.append(json.loads(req.content))
                    edits = {**initial, "$.narration": "Harbour cannot access mechanical test results."} if len(calls) == 1 else {"$.title": "Mechanical prototype tests", "$.film.say": "Mechanical prototype test results are unavailable."}
                    return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(edits)}}]})
                with httpx.Client(transport=httpx.MockTransport(model)) as client:
                    result = generate(job, client)["content"]
                self.assertEqual(len(calls), 2)
                self.assertEqual(result["title"], "Mechanical prototype tests")
                self.assertNotIn("shipped", result["film"]["say"])

    def test_mechanical_test_workflow_rejects_retail_remnants(self):
        import copy
        hook = {"title": "Orbit chatbot", "narration": "Orbit cannot look up data.", "film": {"say": "Where is my order?", "product": "Trailhead 2P Tent"}, "correct": "h1"}
        job = copy.deepcopy(JOB)
        job["input"].update(authored=hook, source=hook, piece="hook", textMapVersion=7, courseId="ai-agent")
        job["input"]["context"]["answers"] = {"domain": "student", "studyFieldOther": "mechanical engineering"}
        calls = []
        def model(req):
            calls.append(json.loads(req.content))
            edits = {"$.title": "Mechanical test assistant", "$.narration": "Harbour cannot access mechanical test data.", "$.film.say": "Has my mechanical prototype shipped?", "$.film.product": "Mechanical 2P prototype"} if len(calls) == 1 else {"$.film.say": "Where are my mechanical stress-test results?", "$.film.product": "Mechanical shaft assembly"}
            return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(edits)}}]})
        with httpx.Client(transport=httpx.MockTransport(model)) as client:
            result = generate(job, client)["content"]
        self.assertEqual(len(calls), 2)
        self.assertIn("$.film.say", calls[1]["messages"][-1]["content"])
        self.assertIn("$.film.product", calls[1]["messages"][-1]["content"])
        self.assertEqual(result["film"]["product"], "Mechanical shaft assembly")

    def setUp(self):
        self.env = patch.dict(os.environ, {"LLM_API_KEY": "test", "LLM_MODEL": "test-model", "LLM_PROVIDER": "openai", "LLM_BASE_URL": "https://model.test/v1", "LLM_FALLBACK_MODEL": "none", "ADAPTIVE_INTERNAL_TOKEN": "test-token-that-is-long-enough"})
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_complete_hook_uses_text_map_and_preserves_film_and_assessment(self):
        from pathlib import Path
        import copy
        module = json.loads((Path(__file__).resolve().parents[3] / "fixtures/module-ai-agent-m1.json").read_text(encoding="utf-8"))
        hook = next(block for block in module["blocks"] if block["stage"] == "hook")
        job = copy.deepcopy(JOB)
        job["input"].update(authored=hook, source=hook, piece="hook", textMapVersion=3, courseId="ai-agent")
        job["input"]["context"]["answers"] = {"domain": "student", "studyFieldOther": "electrical electronics", "expect": "Step by step"}
        calls = []
        def model(req):
            payload = json.loads(req.content)
            supplied = json.loads(payload["messages"][1]["content"])
            calls.append(supplied)
            edits = {key: re.sub(r"Orbit|Maya|Leo|Priya|ORB-\d+", "Harbour", value, flags=re.I) for key, value in supplied["SOURCE"].items()}
            return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(edits)}}]})
        import re
        with httpx.Client(transport=httpx.MockTransport(model)) as client:
            result = generate(job, client)["content"]
        self.assertEqual(len(calls), 1)
        self.assertIn("$.film.shots[0].say", calls[0]["SOURCE"])
        self.assertNotIn("$.step_id", calls[0]["SOURCE"])
        self.assertNotIn("$.objective_ids[0]", calls[0]["SOURCE"])
        self.assertEqual(result["step_id"], hook["step_id"])
        self.assertEqual(result["objective_ids"], hook["objective_ids"])
        self.assertEqual(result["correct"], hook["correct"])
        self.assertEqual(len(result["film"]["shots"]), len(hook["film"]["shots"]))
        self.assertEqual(len(result["reveal"]["timeline"]), len(hook["reveal"]["timeline"]))
        self.assertEqual(result["film"]["shots"][0]["count"], hook["film"]["shots"][0]["count"])
        self.assertIn("Harbour", result["narration"])
        self.assertEqual(calls[0]["LEARNER_FOCUS"]["field"], "electrical electronics")
        self.assertEqual(calls[0]["LEARNER_FOCUS"]["goal"], "Step by step")
        edits = hook_text_map(hook)
        with self.assertRaises(ValueError):
            apply_hook_text_map(hook, {**edits, "$.correct": "forged"})
        del edits["$.narration"]
        with self.assertRaisesRegex(ValueError, "text-map key"):
            apply_hook_text_map(hook, edits)
        sparse = apply_hook_text_map(hook, {"$.title": "A lab assistant that can act"}, sparse=True)
        self.assertEqual(sparse["title"], "A lab assistant that can act")
        self.assertEqual(sparse["film"], hook["film"])
        self.assertEqual(sparse["correct"], hook["correct"])
        with self.assertRaises(ValueError):
            apply_hook_text_map(hook, {"$.correct": "forged"}, sparse=True)

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

    def test_hook_repair_accumulates_valid_edits_without_requesting_full_film(self):
        import copy
        hook = {"stage": "hook", "title": "Orbit bot", "narration": "Orbit helps Maya.", "film": {"shots": [{"type": "site-chat", "say": "Orbit helps."}]}, "correct": "h1"}
        job = copy.deepcopy(JOB)
        job["input"].update(authored=hook, source=hook, piece="hook", textMapVersion=3, courseId="ai-agent")
        calls = []
        def model(req):
            calls.append(json.loads(req.content))
            edits = {"$.title": "Harbour bot", "$.film.shots[0].say": "Harbour helps."} if len(calls) == 1 else {"edits": {"$.narration": "Harbour helps Anika."}}
            return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(edits)}}]})
        with httpx.Client(transport=httpx.MockTransport(model)) as client:
            result = generate(job, client)["content"]
        self.assertEqual(len(calls), 2)
        self.assertEqual(result["title"], "Harbour bot")
        self.assertEqual(result["film"]["shots"][0]["say"], "Harbour helps.")
        self.assertEqual(result["narration"], "Harbour helps Anika.")
        self.assertIn("earlier valid path edits are retained", calls[1]["messages"][-1]["content"])
        self.assertNotIn("Return the complete JSON", calls[1]["messages"][-1]["content"])

    def test_personalised_hook_can_keep_fictional_team_names(self):
        import copy
        hook = {"stage": "hook", "title": "Orbit lab", "narration": "Leo and Maya work at Orbit.", "correct": "h1"}
        job = copy.deepcopy(JOB)
        job["input"].update(authored=hook, source=hook, piece="hook", textMapVersion=4, courseId="ai-agent")
        edits = {"$.title": "Harbour lab", "$.narration": "Leo and Maya work at Harbour Works electronics lab."}
        with httpx.Client(transport=httpx.MockTransport(lambda req: httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(edits)}}]}))) as client:
            result = generate(job, client)["content"]
        self.assertIn("Leo and Maya", result["narration"])
        self.assertNotIn("Orbit", result["narration"])
        self.assertEqual(result["correct"], "h1")

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
                self.assertTrue(system.startswith(SYSTEM))
                if trigger == "example":
                    self.assertIn("adding the field name to an unchanged example is insufficient", system)
                else:
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

    def test_explicit_layout_limits_and_reminder_placement_reach_model(self):
        import copy
        job = copy.deepcopy(JOB)
        slide = {**SLIDE, "note": {"text": "One idea at a time.", "cue": 0}}
        job["input"].update(authored=slide, source=slide)
        job["input"]["context"]["prerequisiteTeaching"] = [{"lessonId": "1.1", "title": "Agents", "keyIdeas": ["Agents use an LLM to choose steps."]}]
        calls = []
        changed = {**slide, "note": {"text": "Quick reminder: agents use an LLM.", "cue": 0}, "sentences": ["Quick reminder: an agent uses tools."]}
        def model(req):
            calls.append(json.loads(req.content))
            return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(changed)}}]})
        with httpx.Client(transport=httpx.MockTransport(model)) as client:
            generate(job, client)
        supplied = json.loads(calls[0]["messages"][1]["content"])
        limits = supplied["OUTPUT_CONSTRAINTS"]
        self.assertEqual(limits["exactArrayLengths"]["$.sentences"], 1)
        self.assertEqual(limits["maximumCharacters"]["$.note.text"], max(40, round(len(slide["note"]["text"]) * 1.8) + 30))
        self.assertNotIn("$.icon", limits["maximumCharacters"])
        self.assertEqual(supplied["PREREQUISITE_BRIDGE_PLACEMENT"]["visiblePath"], "$.note.text")
        with self.assertRaisesRegex(ValueError, "Array structure"):
            validate(slide, {**changed, "sentences": changed["sentences"] * 2})
        with self.assertRaisesRegex(ValueError, "layout limit"):
            validate(slide, {**changed, "note": {"text": "x" * 100, "cue": 0}})
        self.assertEqual(output_constraints(slide), limits)

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

    def test_schema_repair_keeps_working_model(self):
        calls = []
        def model(req):
            payload = json.loads(req.content)
            calls.append(payload["model"])
            content = "invalid" if len(calls) == 1 else json.dumps(SLIDE)
            return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})
        with patch.dict(os.environ, {"LLM_FALLBACK_MODEL": "fallback-model"}), httpx.Client(transport=httpx.MockTransport(model)) as client:
            generate(JOB, client)
        self.assertEqual(calls, ["test-model", "test-model"])

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

    def test_api_logs_provider_status_without_response_body(self):
        client = TestClient(app)
        request = httpx.Request("POST", "https://model.test/v1/chat/completions")
        response = httpx.Response(429, request=request, text="private-provider-response")
        error = httpx.HTTPStatusError("private-provider-response", request=request, response=response)
        with patch("adaptive_api.api.generate", side_effect=error), self.assertLogs("adaptive-api", level="WARNING") as logs:
            result = client.post("/v1/generate", json={"input": JOB["input"]}, headers={"Authorization": "Bearer test-token-that-is-long-enough"})
        self.assertEqual(result.status_code, 502)
        self.assertIn("provider status 429", " ".join(logs.output))
        self.assertNotIn("private-provider-response", " ".join(logs.output))
        self.assertNotIn("private-provider-response", result.text)


if __name__ == "__main__":
    unittest.main()
