import axios, { AxiosError } from 'axios';
import { XMLParser } from 'fast-xml-parser';

// --- КОНФИГУРАЦИЯ ---
const COOLDOWN_MS = 3000;
const SNAPSHOT_TIMEOUT_MS = 2500;

const SNAPSHOT_PATHS = {
  hikvision: [
    '/ISAPI/Streaming/channels/101/picture',
    '/ISAPI/Streaming/channels/1/picture',
    '/Streaming/channels/1/picture',
  ],
  uniview: [
    '/images/snapshot.jpg',
    '/LAPI/V1.0/Channels/1/Media/Video/Streams/0/Snapshot',
    '/cgi-bin/video.cgi?action=snapshot',
  ],
};

const TRIGGER_KEYWORDS = ['face', 'human', 'vmd', 'regionentrance', 'regionexiting', 'linedetection'];

const lastEventTime = new Map<string, number>();

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

export interface CameraConfig {
  id: string;
  ip: string;
  username: string;
  password: string;
  brand: 'hikvision' | 'uniview';
}

export interface WebhookResult {
  success: boolean;
  reason?: string;
  cameraId?: string;
  cameraIp?: string;
  recognition?: any;
  timestamp?: string;
  message?: string;
}

function getCooldownKey(ip: string, cameraId?: string): string {
  return cameraId ? `${cameraId}` : ip;
}

function isDetectionTrigger(payload: string, contentType?: string): boolean {
  const payloadLower = payload.toLowerCase();
  const hasKeyword = TRIGGER_KEYWORDS.some((k) => payloadLower.includes(k));

  let jsonTrigger = false;
  if (contentType?.includes('application/json')) {
    try {
      const data = JSON.parse(payload);
      const jsonStr = JSON.stringify(data).toLowerCase();
      jsonTrigger = TRIGGER_KEYWORDS.some((k) => jsonStr.includes(k));
    } catch {
      // ignore parse errors
    }
  }

  return hasKeyword || jsonTrigger;
}

async function fetchSnapshotUniversal(camera: CameraConfig): Promise<Buffer | null> {
  const paths = SNAPSHOT_PATHS[camera.brand];
  const auth = { username: camera.username, password: camera.password };

  for (const path of paths) {
    try {
      const url = `http://${camera.ip}${path}`;
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        auth,
        timeout: SNAPSHOT_TIMEOUT_MS,
        maxRedirects: 0,
      });

      const buffer = Buffer.from(response.data);
      if (buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
        return buffer;
      }
    } catch (error) {
      const axiosErr = error as AxiosError;
      // try next path on 404/401/timeout
      continue;
    }
  }

  return null;
}

async function sendToPythonService(cameraId: string, imageBuffer: Buffer) {
  const FormDataCtor = (globalThis as any).FormData;
  if (!FormDataCtor) {
    throw new Error('FormData is not available in this environment');
  }

  const form = new FormDataCtor();
  form.append('image', imageBuffer, {
    filename: 'snapshot.jpg',
    contentType: 'image/jpeg',
  });
  form.append('camera_id', String(cameraId));

  const response = await axios.post('http://localhost:8001/recognize', form, {
    headers: (form as any).getHeaders ? (form as any).getHeaders() : {},
    timeout: 5000,
  });

  return response.data;
}

export async function handleCameraWebhook(
  rawBody: string,
  contentType: string | undefined,
  clientIp: string,
  getCameraConfig: (ip: string) => CameraConfig | null
): Promise<WebhookResult> {
  try {
    const now = Date.now();
    const key = getCooldownKey(clientIp);
    const lastTime = lastEventTime.get(key) || 0;
    if (now - lastTime < COOLDOWN_MS) {
      return { success: false, reason: 'cooldown' };
    }

    if (!isDetectionTrigger(rawBody, contentType)) {
      return { success: false, reason: 'not_a_trigger' };
    }

    const camera = getCameraConfig(clientIp);
    if (!camera) {
      return { success: false, reason: 'unknown_camera' };
    }

    lastEventTime.set(key, now);

    const imageBuffer = await fetchSnapshotUniversal(camera);
    if (!imageBuffer) {
      return { success: false, reason: 'snapshot_failed' };
    }

    const recognition = await sendToPythonService(camera.id, imageBuffer);

    return {
      success: true,
      cameraId: camera.id,
      cameraIp: camera.ip,
      recognition,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const err = error as Error;
    return { success: false, reason: 'error', message: err.message };
  }
}
