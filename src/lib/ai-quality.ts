// src/lib/ai-quality.ts — Proxy metrics + feedback loop.
// Json-нормализация: prisma ждёт строку для полей типа String (SQLite)
const writeJson = (v: unknown): string => (typeof v === "string" ? v : JSON.stringify(v));
const readJson  = (v: unknown): any => {
    if (v == null) return null;
    if (typeof v === "string") { try { return JSON.parse(v); } catch { return null; } }
    return v;
};

import { prisma } from "../../db.js";
export type Feedback = "correct" | "wrong_person" | "false_alarm";
export async function recordProxyStat(cameraId: number, patch: { face_px?: number; recognized?: boolean; candidate?: boolean }) {
    const cam = await prisma.camera.findUnique({ where: { id: cameraId }, select: { ai_proxy_stats: true } });
    const s: any = readJson(cam?.ai_proxy_stats) || { n: 0, face_px_sum: 0, cand: 0, rec: 0 };
    s.n += 1;
    if (patch.face_px) s.face_px_sum += patch.face_px;
    if (patch.candidate) s.cand += 1;
    if (patch.recognized) s.rec += 1;
    await prisma.camera.update({ where: { id: cameraId }, data: { ai_proxy_stats: writeJson(s) } });
}
export function geometryAdvice(stats: any) {
    const avg = stats?.n ? stats.face_px_sum / stats.n : null;
    if (avg && avg < 50) return "Avg face < 50px: raise camera 15-20cm or reduce distance.";
    if (avg && avg > 180) return "Avg face > 180px: people too close — narrow ROI or raise camera.";
    return null;
}
export async function recordFeedback(cameraId: number, kind: Feedback) {
    const cam = await prisma.camera.findUnique({ where: { id: cameraId }, select: { feedback_counts: true } });
    const c: any = readJson(cam?.feedback_counts) || { correct: 0, wrong_person: 0, false_alarm: 0 };
    c[kind] = (c[kind] || 0) + 1;
    await prisma.camera.update({ where: { id: cameraId }, data: { feedback_counts: writeJson(c) } });
    return c;
}
export function realAccuracyIfEnough(raw: any): { precision: number } | null {
    const c = readJson(raw);
    const labeled = (c?.correct || 0) + (c?.wrong_person || 0);
    if (labeled < 50) return null;
    return { precision: Math.round((c.correct / labeled) * 1000) / 10 };
}
