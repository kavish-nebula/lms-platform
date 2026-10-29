import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { EMPTY_BRIEF, briefReadiness, CourseBrief, sameCourseBrief } from "@/lib/content-creator";
import { createCreatorDraft, getCreatorDraft, listCreatorDrafts, updateCreatorDraft } from "@/server/content-creator";
import { getSessionUser } from "@/server/auth";
import { db } from "@/server/db/client";
import { users, profiles, stepProgress } from "@/server/db/schema";
import { GET, POST } from "@/app/api/v1/content/courses/route";
import { GET as GET_ONE, PATCH } from "@/app/api/v1/content/courses/[id]/route";

const owner = await getSessionUser();
const database = await db();
const before = { profiles: await database.select().from(profiles), progress: await database.select().from(stepProgress) };
await database.insert(users).values({ id: "creator-test-other", name: "Other", email: "other@example.test" });
assert.deepEqual(await listCreatorDrafts(owner.id), []);
const draft = await createCreatorDraft(owner.id, { brief: EMPTY_BRIEF });
assert.equal(draft.revision, 1);
assert.equal(briefReadiness(draft.brief).filter(c => c.ready).length, 1);
const updated = { ...EMPTY_BRIEF, title: "Mechanical engineering agents", subject: "AI", audience: "Engineers", sourceText: "Approved notes", outcomes: "Design a brief", dependencies: "Concepts before tools", contexts: "Maintenance documentation", difficulties: "Tool boundaries", objectives: [
  { text: "Identify tools", bloom: "Remember" as const }, { text: "Explain agent boundaries", bloom: "Understand" as const }, { text: "Design a brief", bloom: "Create" as const },
] };
assert(briefReadiness(updated).every(c => c.ready));
assert(!briefReadiness({ ...updated, physicalSkills: true }).every(c => c.ready));
const race = await Promise.allSettled([
  updateCreatorDraft(owner.id, draft.id, { brief: updated, revision: 1 }),
  updateCreatorDraft(owner.id, draft.id, { brief: { ...updated, title: "Other tab" }, revision: 1 }),
]);
assert.equal(race.filter(r => r.status === "fulfilled").length, 1);
assert.equal(race.filter(r => r.status === "rejected" && r.reason.status === 409).length, 1);
assert.equal((await getCreatorDraft(owner.id, draft.id)).revision, 2);
const current = await getCreatorDraft(owner.id, draft.id);
const reordered = Object.fromEntries(Object.entries(current.brief).reverse()) as typeof current.brief;
const unchanged = await updateCreatorDraft(owner.id, draft.id, { brief: reordered, revision: 2 });
assert.equal(unchanged.revision, 2, 'An unchanged save must not advance input revision.');
assert.equal(unchanged.updatedAt, current.updatedAt);
assert(sameCourseBrief(reordered, current.brief), 'JSON object key order does not change the source.');
for (const changed of [{ ...current.brief, sourceText: current.brief.sourceText + ' New fact.' }, { ...current.brief, audience: 'Different audience' }, { ...current.brief, duration: 'Different duration' }, { ...current.brief, objectives: [] }]) assert(!sameCourseBrief(changed, current.brief));
await assert.rejects(updateCreatorDraft(owner.id, draft.id, { brief: reordered, revision: 1 }), { status: 409 });
await assert.rejects(getCreatorDraft("creator-test-other", draft.id), { status: 404 });
await assert.rejects(updateCreatorDraft("creator-test-other", draft.id, { brief: updated, revision: 2 }), { status: 404 });
assert.deepEqual(await listCreatorDrafts("creator-test-other"), []);
await assert.rejects(getCreatorDraft(owner.id, "bad-id"), { status: 404 });
assert(!CourseBrief.safeParse({ ...EMPTY_BRIEF, title: "x".repeat(201) }).success);
assert(!CourseBrief.safeParse({ ...EMPTY_BRIEF, objectives: [{ text: "x", bloom: "Magic" }] }).success);
const req = (data: unknown, method = "POST") => new Request("http://localhost/api/v1/content/courses", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
assert.equal((await POST(req({ brief: EMPTY_BRIEF, ownerId: "creator-test-other" }))).status, 400);
assert.equal((await POST(req({ brief: { ...EMPTY_BRIEF, physicalSkills: "yes" } }))).status, 400);
assert.equal((await POST(new Request("http://localhost", { method: "POST", body: "{" }))).status, 400);
const createResponse = await POST(req({ brief: updated }));
assert.equal(createResponse.status, 201);
const created = (await createResponse.json()).course;
const context = { params: Promise.resolve({ id: created.id }) };
assert.equal((await GET_ONE(new Request("http://localhost"), context)).status, 200);
assert.equal((await PATCH(req({ brief: EMPTY_BRIEF, revision: 9 }, "PATCH"), context)).status, 409);
assert.equal((await PATCH(req({ brief: EMPTY_BRIEF, revision: 1 }, "PATCH"), context)).status, 200);
assert.equal((await GET()).status, 200);
assert.equal((await database.select().from(users).where(eq(users.id, owner.id))).length, 1);
assert.deepEqual({ profiles: await database.select().from(profiles), progress: await database.select().from(stepProgress) }, before);
console.log("PASS creator drafts: additive migration, incomplete save, readiness, validation, owner isolation, atomic conflict, API contracts, learner data unchanged");
