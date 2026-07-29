// src/lib/health-score.ts — Versioned health score (not stored in DB).
const readJson = (v: unknown): any => {
    if (v == null) return null;
    if (typeof v === "string") { try { return JSON.parse(v); } catch { return null; } }
    return v;
};

type Raw = { detected_fps?: number | null; stream_sub_url?: string | null; detected_bitrate_kbps?: number | null; roi_polygon?: any; passage_roi_x_min?: number; passage_roi_x_max?: number; passage_roi_y_min?: number; passage_roi_y_max?: number; distance_calib_mode?: string | null; stream_recommendation?: any; };
interface Penalty { label: string; points: number }
const RULES_V3 = { version: "v3", checks: (r: Raw): Penalty[] => {
    const p: Penalty[] = [];
    if ((r.detected_fps ?? 0) > 20) p.push({ label: "Substream fps too high", points: 10 });
    if (!r.stream_sub_url) p.push({ label: "No substream (tracker on main)", points: 5 });
    if ((r.detected_bitrate_kbps ?? 9999) < 1500) p.push({ label: "Low bitrate -> artifacts", points: 8 });
    if (roiArea(r) > 0.7) p.push({ label: "ROI > 70% of frame", points: 3 });
    if (!r.distance_calib_mode) p.push({ label: "No distance calibration", points: 6 });
    const rec = readJson(r.stream_recommendation);
    if (rec?.notes?.length) p.push({ label: "Camera tuning recommendations available", points: 2 });
    return p;
}};
function roiArea(r: Raw): number {
    const roi = Array.isArray(r.roi_polygon) ? r.roi_polygon : readJson(r.roi_polygon);
    if (Array.isArray(roi) && roi.length >= 3) return polyArea(roi);
    const w = (r.passage_roi_x_max ?? 1) - (r.passage_roi_x_min ?? 0);
    const h = (r.passage_roi_y_max ?? 1) - (r.passage_roi_y_min ?? 0);
    return Math.max(0, Math.min(1, w)) * Math.max(0, Math.min(1, h));
}
function polyArea(p: number[][]): number { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.min(1, Math.abs(a) / 2); }
export function computeHealthScore(raw: Raw, version = "v3") {
    const penalties = RULES_V3.checks(raw);
    const score = Math.max(0, 100 - penalties.reduce((s, x) => s + x.points, 0));
    return { score, version, penalties };
}
