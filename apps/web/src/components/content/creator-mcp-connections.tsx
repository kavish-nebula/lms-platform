'use client';
import { useState, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatIst } from '@/lib/display-time';

type Connection = { id: string; expiresAt: string; allowPublication: boolean };
const endpoint = '/api/v1/content/mcp-connections';
const subscribeOrigin = () => () => {};
export function CreatorMcpConnections() {
  const { data, error: loadError, mutate } = useSWR(endpoint, (url: string) => api<{ connections: Connection[] }>(url));
  const connections = data?.connections ?? [];
  const [created, setCreated] = useState<(Connection & { token: string }) | null>(null);
  const [allowPublication, setAllowPublication] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const origin = useSyncExternalStore(subscribeOrigin, () => window.location.origin, () => '');
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); try { await action(); await mutate(); } catch (e) { setError(e instanceof Error ? e.message : 'Connection operation failed.'); } finally { setBusy(false); } }
  return <div className="mx-auto max-w-4xl space-y-6">
    <Link href="/content" className="text-brand-ink underline">Back to Content Creator</Link>
    <header className="space-y-3"><h1 className="text-3xl font-semibold">Create courses through prompts</h1><p className="text-ink-muted">Connect your MCP-capable agent, describe the course, review the saved draft here, then publish the approved revision.</p></header>
    <section className="space-y-4 rounded-xl border border-line bg-panel p-6" aria-labelledby="creator-mcp-access">
      <h2 id="creator-mcp-access" className="text-xl font-semibold">1. Create a creator connection</h2>
      <p>This connection can read and edit all courses owned by your current creator account and create new briefs. It expires after eight hours. Existing single-course connections keep their original scope.</p>
      <label className="flex items-start gap-3"><input type="checkbox" checked={allowPublication} onChange={e => setAllowPublication(e.target.checked)} disabled={busy} /><span>Also allow publishing an exact revision after its human approval. Without this permission, publish from the app.</span></label>
      <Button disabled={busy} onClick={() => void run(async () => { setCreated((await api<{ connection: Connection & { token: string } }>(endpoint, { method: 'POST', body: { allowPublication } })).connection); })}>{busy ? 'Working…' : 'Create connection'}</Button>
      {created && <div className="space-y-3 rounded-lg border border-line bg-panel-2 p-4"><p className="font-medium">Copy this token now. It is shown only for this new connection.</p><label className="block text-sm">Bearer token<input aria-label="New MCP bearer token" type="password" readOnly value={created.token} className="mt-2 block w-full rounded border border-line bg-panel p-3 font-mono" /></label><Button variant="outline" onClick={() => void navigator.clipboard.writeText(created.token).catch(() => setError('Clipboard unavailable. Select and copy the token field.'))}>Copy token</Button><Button variant="ghost" onClick={() => setCreated(null)}>Hide token</Button><p className="text-sm">Expires {formatIst(created.expiresAt)}. Keep it in your agent’s secret environment, not source control.</p></div>}
    </section>
    <section className="space-y-3 rounded-xl border border-line bg-panel p-6"><h2 className="text-xl font-semibold">2. Connect your agent</h2><p>For Codex, put the token in the <code>LMS_CREATOR_MCP_TOKEN</code> environment variable available to Codex, then add:</p><pre className="overflow-auto whitespace-pre-wrap rounded-lg bg-panel-2 p-4 text-sm">{`[mcp_servers.nebula_course_authoring]\nurl = "${origin}/api/mcp/course-authoring"\nbearer_token_env_var = "LMS_CREATOR_MCP_TOKEN"`}</pre><p className="text-sm text-ink-muted">Other MCP clients can use this Streamable HTTP endpoint with an Authorization: Bearer header. The agent must be able to reach this app.</p></section>
    <section className="space-y-3 rounded-xl border border-line bg-panel p-6"><h2 className="text-xl font-semibold">3. Plan, draft, review and publish</h2><ol className="list-decimal space-y-2 pl-5"><li>“Plan a course on AI basics for office staff using these source notes. Use an 80% final pass mark. Show the plan first.”</li><li>“Create the accepted brief and complete editable course draft using the authoring schemas and course-creation workflow.”</li><li>“Revise this lesson” or “Generate the end quiz for Module 1.”</li><li>“Review the course and show the findings and review link.” Open that link to inspect and approve the exact revision.</li><li>“Publish the approved revision.” This requires a publication-enabled connection; otherwise publish in the app.</li></ol><p className="text-sm text-ink-muted">The agent generates content. MCP validates and saves it. Tools do not verify facts, generate missing audio or grant human approval. Source-library courses retain blueprint and module-review requirements.</p></section>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Active connections</h2>{connections.length === 0 && <p>No active creator connections.</p>}{connections.map(c => <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-4"><p className="text-sm">{c.allowPublication ? 'Drafts and approved publication' : 'Draft authoring'} · Expires {formatIst(c.expiresAt)}</p><Button variant="outline" disabled={busy} onClick={() => void run(async () => { await api(endpoint, { method: 'DELETE', body: { id: c.id } }); if (created?.id === c.id) setCreated(null); })}>Revoke connection</Button></div>)}</section>
    {(error || loadError) && <p role="alert" className="text-destructive">{error || loadError.message}</p>}
  </div>;
}
