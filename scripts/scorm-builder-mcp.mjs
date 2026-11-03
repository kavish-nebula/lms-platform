/** Read-only Codex bridge to SCORM Builder; credentials stay in the auth CLI store. */
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const allowed = new Set(['list_courses', 'get_course_structure', 'list_topics', 'get_topic', 'list_releases', 'get_release', 'list_concepts']);
const remote = new Client({ name: 'nebula-lms-readonly', version: '1.0.0' });
try {
  const credentialPath = path.join(process.env.SCORM_AUTH_DIR || path.join(os.homedir(), '.scorm-auth'), 'credentials.json');
  const auth = JSON.parse(await readFile(credentialPath, 'utf8'));
  if (typeof auth.apiKey !== 'string' || !auth.apiKey) throw new Error('missing credential');
  await remote.connect(new StreamableHTTPClientTransport(new URL('https://scorm-builder-app-759854934093.asia-south1.run.app/mcp'), {
    requestInit: { headers: { Authorization: `Bearer ${auth.apiKey}` } },
  }));
  const server = new Server({ name: 'scorm-builder-readonly', version: '1.0.0' }, { capabilities: { tools: {}, resources: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const result = await remote.listTools();
    return { tools: result.tools.filter(tool => allowed.has(tool.name)).map(tool => ({ ...tool, annotations: { ...tool.annotations, readOnlyHint: true, destructiveHint: false } })) };
  });
  server.setRequestHandler(CallToolRequestSchema, async request => {
    if (!allowed.has(request.params.name)) return { isError: true, content: [{ type: 'text', text: 'This connection only permits course/schema inspection.' }] };
    return remote.callTool(request.params);
  });
  server.setRequestHandler(ListResourcesRequestSchema, request => remote.listResources(request.params));
  server.setRequestHandler(ReadResourceRequestSchema, request => remote.readResource(request.params));
  await server.connect(new StdioServerTransport());
  const stop = async () => { await server.close(); await remote.close(); };
  process.once('SIGINT', () => void stop());
  process.once('SIGTERM', () => void stop());
  process.stdin.once('end', () => void remote.close());
} catch {
  console.error('SCORM Builder connection failed. Check network/access and sign in with npx nebula-scorm-auth login. No credentials were logged.');
  await remote.close();
  process.exitCode = 1;
}
