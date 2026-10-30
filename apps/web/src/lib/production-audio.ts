import { z } from 'zod/v4';

export type ProductionVoice = { provider: 'kokoro'; model: string; voice: string; dtype: string; device: string; version: 1 | 2 | 3 };
export type ProductionAudioClip = { slideId: string; key: string; narrationHash: string; seconds: number; reused: boolean };
export type ProductionAudioJob = { id: string; revisionId: string; reviewId: string; status: 'running' | 'ready' | 'failed'; clips: ProductionAudioClip[]; voice: ProductionVoice; error: string | null; attempts: number; current: boolean; createdAt: string; shortSlides?: string[]; longSlides?: string[] };
export type ProductionAudioState = { eligible: boolean; reason: string; configured: boolean; jobs: ProductionAudioJob[]; minimumSeconds?: number; maximumSeconds?: number };
export const StartProductionAudio = z.object({ jobId: z.uuid(), revisionId: z.uuid(), reviewId: z.uuid() }).strict();
