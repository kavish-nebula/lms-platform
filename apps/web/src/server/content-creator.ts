import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { CourseBrief, sameCourseBrief, type CreatorDraft } from "@/lib/content-creator";
import { db } from "./db/client";
import { creatorCourses } from "./db/schema";
import { ApiError } from "./http";
import { PRODUCTION_FORMATS } from '@/lib/longform-production';
import { DELIVERY_STRUCTURES } from '@/lib/course-delivery';

export const CreateDraft = z.object({ brief: CourseBrief }).strict();
export const UpdateDraft = z.object({ brief: CourseBrief, revision: z.number().int().positive().max(2147483646) }).strict();
type Row = typeof creatorCourses.$inferSelect;
const view = (row: Row): CreatorDraft => ({ id: row.id, brief: row.brief, revision: row.revision, productionFormat: row.productionFormat, deliveryStructure: row.deliveryStructure, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
export const SetDeliveryStructure = z.object({ structure: z.enum(DELIVERY_STRUCTURES), expectedStructure: z.enum(DELIVERY_STRUCTURES) }).strict();
export async function setDeliveryStructure(ownerId: string, id: string, input: z.infer<typeof SetDeliveryStructure>) {
  validId(id); const data = SetDeliveryStructure.parse(input); const database = await db();
  const [row] = await database.update(creatorCourses).set({ deliveryStructure: data.structure, updatedAt: new Date() }).where(and(eq(creatorCourses.id, id), eq(creatorCourses.ownerId, ownerId), eq(creatorCourses.deliveryStructure, data.expectedStructure))).returning();
  if (!row) { await getCreatorDraft(ownerId, id); throw new ApiError(409, 'delivery_conflict', 'Course delivery structure changed. Reload before saving.'); }
  return view(row);
}
export const SetProductionFormat = z.object({ format: z.enum(PRODUCTION_FORMATS), expectedFormat: z.enum(PRODUCTION_FORMATS) }).strict();
export async function setProductionFormat(ownerId: string, id: string, input: z.infer<typeof SetProductionFormat>) {
  validId(id); const data = SetProductionFormat.parse(input); const database = await db();
  const [row] = await database.update(creatorCourses).set({ productionFormat: data.format, updatedAt: new Date() }).where(and(eq(creatorCourses.id, id), eq(creatorCourses.ownerId, ownerId), eq(creatorCourses.productionFormat, data.expectedFormat))).returning();
  if (!row) { const current = await getCreatorDraft(ownerId, id); if (current.productionFormat === data.format) return current; throw new ApiError(409, 'format_conflict', 'Production format changed in another tab. Reload its current value.'); }
  return view(row);
}
const validId = (id: string) => { if (!z.uuid().safeParse(id).success) throw new ApiError(404, "not_found", "Course draft not found."); };

export async function listCreatorDrafts(ownerId: string) {
  return (await (await db()).select().from(creatorCourses).where(eq(creatorCourses.ownerId, ownerId)).orderBy(desc(creatorCourses.updatedAt))).map(view);
}
export async function getCreatorDraft(ownerId: string, id: string) {
  validId(id);
  const [row] = await (await db()).select().from(creatorCourses).where(and(eq(creatorCourses.id, id), eq(creatorCourses.ownerId, ownerId)));
  if (!row) throw new ApiError(404, "not_found", "Course draft not found.");
  return view(row);
}
export async function createCreatorDraft(ownerId: string, input: z.infer<typeof CreateDraft>) {
  const { brief } = CreateDraft.parse(input);
  const [row] = await (await db()).insert(creatorCourses).values({ ownerId, brief, deliveryStructure: 'codex-ild-v2' }).returning();
  return view(row);
}
export async function updateCreatorDraft(ownerId: string, id: string, input: z.infer<typeof UpdateDraft>) {
  validId(id);
  const { brief, revision } = UpdateDraft.parse(input);
  return (await db()).transaction(async tx => {
    const [current] = await tx.select().from(creatorCourses).where(and(eq(creatorCourses.id, id), eq(creatorCourses.ownerId, ownerId))).for('update');
    if (!current) throw new ApiError(404, 'not_found', 'Course draft not found.');
    if (current.revision !== revision) throw new ApiError(409, 'draft_conflict', 'A newer version was saved in another tab. Your text is still here. Copy it before opening the latest saved version.');
    // Saving identical input must not invalidate a paid, reviewed production run.
    if (sameCourseBrief(current.brief, brief)) return view(current);
    const [row] = await tx.update(creatorCourses).set({ brief, revision: sql`${creatorCourses.revision} + 1`, updatedAt: new Date() }).where(eq(creatorCourses.id, id)).returning();
    return view(row);
  });
}
