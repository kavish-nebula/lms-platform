import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { resolveCreatorMcpGrant } from '@/server/creator-mcp';
import { creatorMcpServer } from '@/server/creator-mcp-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  const token = /^Bearer\s+([A-Za-z0-9_-]+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token) return Response.json({ error: 'A creator-workspace MCP bearer token is required.' }, { status: 401, headers: { 'WWW-Authenticate': 'Bearer', 'Cache-Control': 'no-store' } });
  let grant;
  try { grant = await resolveCreatorMcpGrant(token); }
  catch { return Response.json({ error: 'Creator connection expired or revoked. Create a new connection in Content Creator.' }, { status: 401, headers: { 'WWW-Authenticate': 'Bearer', 'Cache-Control': 'no-store' } }); }
  const server = creatorMcpServer(grant);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 2_100_000 });
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
export const POST = handle;
export const GET = handle;
export const DELETE = handle;
