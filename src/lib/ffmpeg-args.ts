// src/lib/ffmpeg-args.ts — buildFfmpegArgs: enum strategy + scale.
import { resolveDecodeStrategy, getHostPolicy } from "./decode-policy.js";
export interface FfmpegCamInput { url: string; isSubstreamForTracking: boolean; force_decode_strategy?: string | null; detected_codec?: string | null; detected_width?: number | null; detected_height?: number | null; detection_max_width: number; stream_fps?: number | null; }
export async function buildFfmpegArgs(cam: FfmpegCamInput, cameraCount: number): Promise<string[]> {
    const host = await getHostPolicy();
    const strategy = resolveDecodeStrategy(cam, host, cameraCount);
    const args: string[] = ["-rtsp_transport","tcp","-fflags","+discardcorrupt","-analyzeduration","1000000"];
    if (strategy === "cuda") args.push("-hwaccel","cuda","-c:v", cam.detected_codec === "hevc" ? "hevc_cuvid" : "h264_cuvid");
    else if (strategy === "qsv") args.push("-hwaccel","qsv","-c:v", cam.detected_codec === "hevc" ? "hevc_qsv" : "h264_qsv");
    args.push("-i", cam.url);
    const vf: string[] = [`scale=${cam.detection_max_width}:-2`];
    if (cam.isSubstreamForTracking && (cam.stream_fps ?? 0) > 4) {
        const skipN = Math.max(1, Math.round((cam.stream_fps ?? 25) / 3));
        vf.push(`select='not(mod(n\\,${skipN}))'`); args.push("-vsync","vfr");
    }
    args.push("-vf", vf.join(","));
    args.push("-f","rawvideo","-pix_fmt","bgr24","pipe:1");
    return args;
}
