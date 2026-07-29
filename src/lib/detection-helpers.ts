// src/lib/detection-helpers.ts — фильтр кандидатов по зоне + proxy-метрики
export function isInRange(d: number | null | undefined, cam: any): boolean {
    if (d == null) return false;
    const ign = cam.distance_ignore_m ?? 1.5;
    const mn  = cam.distance_min_m    ?? 2.0;
    const mx  = cam.distance_max_m    ?? 4.0;
    return d >= ign && d >= mn && d <= mx;
}
export const faceWidthPx = (b: [number, number, number, number]) => Math.max(1, b[2] - b[0]);
