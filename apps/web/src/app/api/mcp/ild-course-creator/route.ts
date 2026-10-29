import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod/v3';
import type { AuthoredCoursePackageData } from '@/lib/authored-course';
import { getCodexCourseContext, resolveCodexGrant, saveAuthoredCourse, authoredCourseState } from '@/server/authored-course';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request) {
  const match = /^Bearer\s+([A-Za-z0-9_-]+)$/i.exec(request.headers.get('authorization') ?? '');
  if (!match) return Response.json({ error: 'A course-scoped LMS Codex bearer token is required.' }, { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } });
  let grant;
  try { grant = await resolveCodexGrant(match[1]); }
  catch { return Response.json({ error: 'This Codex connection expired or was revoked. Create a new connection in the course workspace.' }, { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }); }

  const server = new McpServer({ name: 'lms-ild-course-creator', version: '1.0.0' }, {
    instructions: 'This connection is scoped to exactly one LMS course. Read the SME brief and sources, generate an editable Codex ILD course draft, then save it as a new owner-scoped revision. Never publish courses or claim that source citations were verified.',
  });
  server.registerTool('get_course_context', { title: 'Get course brief and ILD source context', description: 'Read the saved SME brief, objectives, source blocks, source policy and current blueprint for this one course.' }, async () => ({ content: [{ type: 'text', text: JSON.stringify(await getCodexCourseContext(grant.ownerId, grant.courseId)) }] }));
  server.registerTool('get_course_draft', { title: 'Read the latest authored course draft', description: 'Read the current course package revision and review status for this one course.' }, async () => ({ content: [{ type: 'text', text: JSON.stringify(await authoredCourseState(grant.ownerId, grant.courseId)) }] }));
  server.registerTool('save_course_draft', {
    title: 'Save a complete authored course draft',
    description: 'Validate and append a full editable ILD course package. Supply packageJson as JSON text, with the current SME brief revision and expected package version from get_course_context/get_course_draft. This never publishes.',
    inputSchema: { expectedBriefRevision: z.number().int().positive(), expectedVersion: z.number().int().nonnegative(), packageJson: z.string().min(2).max(2_000_000) },
  }, async ({ expectedBriefRevision, expectedVersion, packageJson }) => {
    let content: unknown;
    try { content = JSON.parse(packageJson); } catch { return { isError: true, content: [{ type: 'text', text: 'packageJson must contain valid JSON.' }] }; }
    const result = await saveAuthoredCourse(grant.ownerId, grant.courseId, { expectedBriefRevision, expectedVersion, content: content as AuthoredCoursePackageData });
    return { content: [{ type: 'text', text: JSON.stringify({ saved: true, revision: result }) }] };
  });

  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 2_100_000 });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function POST(request: Request) { return handle(request); }
export async function GET(request: Request) { return handle(request); }
export async function DELETE(request: Request) { return handle(request); }
