import * as z from "zod/v4";
import { body, handle, ok, ApiError } from "@/server/http";
import { claimJob, failJob, finishJob, heartbeat, internalAuth } from "@/server/adapt/live";
import { closeDb } from '@/server/db/client';

export const runtime = "nodejs";
export const POST = handle(async (req: Request, ctx: { params: Promise<{ action: string }> }) => {
  internalAuth(req);
  const { action } = await ctx.params;
  if (action === 'shutdown') {
    await closeDb();
    return ok({ ok: true });
  }
  if (action === "claim") {
    const input = await body(req, z.object({ lane: z.enum(["all", "interactive", "background"]).default("all") }));
    return ok({ job: await claimJob(input.lane) });
  }
  const input = await body(req, z.object({ id: z.uuid(), lease: z.uuid(), content: z.unknown().optional(), model: z.string().max(160).default("unknown"), metrics: z.record(z.string(), z.number().nonnegative().finite()).default({}) }));
  if (action === "heartbeat") await heartbeat(input.id, input.lease);
  else if (action === "result") await finishJob(input.id, input.lease, input.content, input.model, input.metrics);
  else if (action === "failure") await failJob(input.id, input.lease);
  else throw new ApiError(404, "unknown_action", "Unknown worker action.");
  return ok({ ok: true });
});
