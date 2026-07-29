// src/lib/ai-quality.ts — Proxy metrics + feedback loop.
import { prisma } from "../../db.js";
export type Feedback = "correct" | "wrong_person" | "false_alarm";
export async function recordProxyStat(cameraId: string, patch: { face_px?: number; recognized?: boolean; candidate?: boolean; }) {
    const id = Number(cameraId);
    const cam = await prisma.camera.findUnique({ where: { id }, select: { ai_proxy_stats: true } });
    const s: any = cam?.ai_proxy_stats ? JSON.parse(cam.ai_proxy_stats) : { n: 0, face_px_sum: 0, cand: 0, rec: 0 };
    s.n += 1; if (patch.face_px) s.face_px_sum += patch.face_px; if (patch.candidate) s.cand += 1; if (patch.recognized) s.rec += 1;
    await prisma.camera.update({ where: { id }, data: { ai_proxy_stats: JSON.stringify(s) } });
}
export function geometryAdvice(stats: any) {
    const avg = stats?.n ? stats.face_px_sum / stats.n : null;
    if (avg && avg < 50) return "Avg face < 50px: raise camera 15-20cm or reduce distance.";
    if (avg && avg > 180) return "Avg face > 180px: people too close — narrow ROI or raise camera.";
    return null;
}
export async function recordFeedback(cameraId: string, kind: Feedback) {
    const id = Number(cameraId);
    const cam = await prisma.camera.findUnique({ where: { id }, select: { feedback_counts: true } });
    const c: any = cam?.feedback_counts ? JSON.parse(cam.feedback_counts) : { correct: 0, wrong_person: 0, false_alarm: 0 };
    c[kind] = (c[kind] || 0) + 1;
    await prisma.camera.update({ where: { id }, data: { feedback_counts: JSON.stringify(c) } });
    return c;
}
export function realAccuracyIfEnough(c: any): { precision: number } | null {
    const labeled = (c?.correct || 0) + (c?.wrong_person || 0);
    if (labeled < 50) return null;
    return { precision: Math.round((c.correct / labeled) * 1000) / 10 };
}
