// src/lib/decode-policy.ts — Server-side decode policy.
import { prisma } from "../../db.js";
export type DecodeStrategy = "auto" | "software" | "cuda" | "qsv" | "off";
export interface HostPolicy { strategy: DecodeStrategy; hasGpu: boolean; hwMinCameras: number; hwMinPixels: number; }
let cached: { policy: HostPolicy; at: number } | null = null;
const TTL_MS = 30_000;
export async function getHostPolicy(): Promise<HostPolicy> {
    if (cached && Date.now() - cached.at < TTL_MS) return cached.policy;
    let row = await prisma.systemConfig.findUnique({ where: { id: "default" } });
    if (!row) row = await prisma.systemConfig.upsert({ where: { id: "default" }, create: { id: "default", server_has_gpu: await detectGpu() }, update: {} });
    const policy: HostPolicy = { strategy: (row.server_decode_strategy as DecodeStrategy) || "auto", hasGpu: row.server_has_gpu, hwMinCameras: row.server_hw_min_cameras, hwMinPixels: row.server_hw_min_pixels };
    cached = { policy, at: Date.now() }; return policy;
}
export function invalidatePolicyCache() { cached = null; }
export async function detectGpu(): Promise<boolean> {
    try { const { execSync } = await import("child_process"); execSync("nvidia-smi -L", { stdio: "ignore", timeout: 3000 }); return true; }
    catch { return false; }
}
export function resolveDecodeStrategy(cam: { force_decode_strategy?: string | null; detected_codec?: string | null; detected_width?: number | null; detected_height?: number | null }, host: HostPolicy, cameraCount: number): Exclude<DecodeStrategy, "auto"> {
    if (cam.force_decode_strategy && cam.force_decode_strategy !== "auto") return cam.force_decode_strategy as any;
    if (host.strategy !== "auto") return host.strategy === "off" ? "software" : host.strategy as any;
    if (!host.hasGpu) return "software";
    const c = cam.detected_codec;
    if (c !== "h264" && c !== "hevc") return "software";
    const px = (cam.detected_width ?? 0) * (cam.detected_height ?? 0);
    if (!(cameraCount >= host.hwMinCameras || px >= host.hwMinPixels)) return "software";
    return c === "hevc" ? "qsv" : "cuda";
}
