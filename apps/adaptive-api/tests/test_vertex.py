import os
import unittest
from unittest.mock import patch
import httpx
from adaptive_api.config import settings
from adaptive_api.pipeline import call_model


class VertexTests(unittest.TestCase):
    def test_explicit_vertex_ignores_api_key_endpoint(self):
        with patch.dict(os.environ, {'LLM_PROVIDER': 'openai', 'LLM_API_KEY': 'api-key', 'LLM_BASE_URL': 'https://example.invalid', 'GOOGLE_CLOUD_PROJECT': 'nebula-lms', 'GOOGLE_CLOUD_LOCATION': 'us-central1'}):
            c = settings('vertex')
            self.assertEqual(c['provider'], 'vertex')
            self.assertEqual(c['key'], '')
            self.assertIn('us-central1-aiplatform.googleapis.com', c['base'])

    def test_vertex_call_uses_oauth_and_google_model(self):
        def receive(req):
            self.assertEqual(req.headers['authorization'], 'Bearer test-oauth')
            self.assertNotIn('x-goog-api-key', req.headers)
            import json
            self.assertEqual(json.loads(req.content)['model'], 'google/gemini-test')
            return httpx.Response(200, json={'choices': [{'message': {'content': '{}'}}]})
        with patch('adaptive_api.config.vertex_access_token', return_value='test-oauth'), httpx.Client(transport=httpx.MockTransport(receive)) as client:
            self.assertEqual(call_model(client, {'provider': 'vertex', 'key': '', 'base': 'https://us-central1-aiplatform.googleapis.com/v1/projects/nebula-lms/locations/us-central1/endpoints/openapi'}, 'gemini-test', [{'role': 'system', 'content': 'rules'}, {'role': 'user', 'content': 'test'}]), '{}')

    def test_invalid_project_rejected(self):
        with patch.dict(os.environ, {'GOOGLE_CLOUD_PROJECT': '../invalid', 'GOOGLE_CLOUD_LOCATION': 'us-central1'}):
            with self.assertRaises(ValueError):
                settings('vertex')
