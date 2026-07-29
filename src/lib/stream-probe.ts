// src/lib/stream-probe.ts — ffprobe auto-detect + backfill.
import { execFile } from "child_process";
import { prisma } from "../../db.js";
export interface ProbeResult { width: number | null; height: number | null; fps: number | null; codec: string | null; bitrate_kbps: number | null; gop: number | null; }
const CURRENT_PROFILE_VERSION = 2;
function ffprobe(url: string, timeoutMs = 8000): Promise<any> {
    return new Promise((resolve, reject) => {
        const args = ["-v","error","-select_streams","v:0","-show_entries","stream=width,height,codec_name,avg_frame_rate,bit_rate","-show_entries","format=bit_rate","-of","json",url];
        const child = execFile("ffprobe", args, { timeout: timeoutMs }, (err, stdout) => { if (err) return reject(err); try { resolve(JSON.parse(stdout)); } catch (e) { reject(e); } });
        child.on("error", reject);
    });
}
function parseFps(s?: string): number | null {
    if (!s || s === "0/0") return null;
    if (s.includes("/")) { const [n, d] = s.split("/").map(Number); return d ? Math.round((n / d) * 10) / 10 : null; }
    const v = parseFloat(s); return isFinite(v) ? v : null;
}
export async function probeStream(url: string): Promise<ProbeResult> {
    const empty: ProbeResult = { width: null, height: null, fps: null, codec: null, bitrate_kbps: null, gop: null };
    try {
        const data = await ffprobe(url); const st = data?.streams?.[0]; if (!st) return empty;
        const br = parseInt(st.bit_rate || data?.format?.bit_rate || "0", 10);
        return { width: st.width ?? null, height: st.height ?? null, fps: parseFps(st.avg_frame_rate), codec: st.codec_name ?? null, bitrate_kbps: br > 0 ? Math.round(br / 1024) : null, gop: null };
    } catch { return empty; }
}
function buildRecommendation(r: ProbeResult) {
    const notes: string[] = [];
    if ((r.fps ?? 0) > 20) notes.push("Substream fps >20: reduce to 10-15 in camera web UI.");
    if (!r.codec) notes.push("Codec unknown: check RTSP availability.");
    return { sub_fps_rec: 12, notes, doc_link: "https://github.com/supreme-spec/kraken#camera-tuning" };
}
export async function applyProbe(cameraId: string, url: string): Promise<void> {
    const r = await probeStream(url);
    const anyDetected = r.width || r.height || r.fps || r.codec;
    const id = Number(cameraId);
    await prisma.camera.update({ where: { id }, data: { detected_width: r.width, detected_height: r.height, detected_fps: r.fps, detected_codec: r.codec, detected_bitrate_kbps: r.bitrate_kbps, detected_gop: r.gop, detected_at: new Date(), profile_version: CURRENT_PROFILE_VERSION, profile_needs_refresh: !anyDetected, stream_recommendation: JSON.stringify(buildRecommendation(r)) } });
}
export async function backfillProfiles(cameraIds?: string[]): Promise<{ ok: number; flagged: number }> {
    const where = cameraIds ? { id: { in: cameraIds.map(Number) } } : { profile_needs_refresh: true };
    const cams = await prisma.camera.findMany({ where, select: { id: true, source: true } });
    let ok = 0, flagged = 0;
    for (const c of cams) { await applyProbe(String(c.id), c.source); const after = await prisma.camera.findUnique({ where: { id: c.id }, select: { profile_needs_refresh: true } }); after?.profile_needs_refresh ? flagged++ : ok++; }
    return { ok, flagged };
}
export async function markStaleProfilesOnBoot(): Promise<number> {
    const r = await prisma.camera.updateMany({ where: { profile_version: { lt: CURRENT_PROFILE_VERSION } }, data: { profile_needs_refresh: true } });
    return r.count;
}
