import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

// ─── КОНФИГУРАЦИЯ ─────────────────────────────────────────────────────────────
const COOLDOWN_MS = 3000;
const SNAPSHOT_TIMEOUT_MS = 2500;
const RECOGNITION_TIMEOUT_MS = 5000;

// Заполните реальными IP ваших 18 камер
export const ALLOWED_CAMERA_IPS = new Set<string>([
  // Uniview
  '192.168.1.50',
  '192.168.1.51',
  '192.168.1.52',
  // Hikvision
  '192.168.1.60',
  '192.168.1.61',
  '192.168.1.62',
]);

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

const TRIGGER_KEYWORDS = [
  'face',
  'human',
  'vmd',
  'regionentrance',
  'regionexiting',
  'linedetection',
  'intelligent',
];

const webhookCooldown = new Map<string, number>();
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
  snapshot_path?: string;
  timestamp?: string;
  message?: string;
}

function cleanIp(ip: string): string {
  return ip.replace(/^::ffff:/i, '');
}

function getCooldownKey(ip: string, cameraId?: string): string {
  return cameraId ? `cam:${cameraId}` : `ip:${ip}`;
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
  const auth =
    camera.username && camera.password
      ? { username: camera.username, password: camera.password }
      : undefined;

  for (const snapshotPath of paths) {
    try {
      const url = `http://${camera.ip}${snapshotPath}`;
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        auth,
        timeout: SNAPSHOT_TIMEOUT_MS,
      } as any);

      const buffer = Buffer.from(response.data as ArrayBuffer);
      if (buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
        return buffer;
      }
    } catch (error) {
      const axiosErr = error as any;
      // Пробуем следующий путь при 404/401/timeout
      continue;
    }
  }

  return null;
}

async function saveSnapshotToDisk(personName: string | undefined, buffer: Buffer): Promise<string> {
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const safeName = (personName || 'unknown').replace(/[^a-zA-Zа-яА-Я0-9]/g, '_').substring(0, 30);
  const filename = `${dateStr}_${timeStr}_${safeName}.jpg`;

  // Путь к snapshots будет определён в server.ts
  const fs = await import('fs');
  const path = await import('path');
  const snapshotsDir = path.join(process.cwd(), 'public', 'snapshots');

  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true });
  }

  const filepath = path.join(snapshotsDir, filename);
  fs.writeFileSync(filepath, buffer);
  return `snapshots/${filename}`;
}

export async function handleCameraWebhook(
  rawBody: string,
  contentType: string | undefined,
  clientIp: string,
  getCameraConfig: (ip: string) => CameraConfig | null
): Promise<WebhookResult> {
  try {
    const now = Date.now();
    const ip = cleanIp(clientIp);
    const key = getCooldownKey(ip);
    const lastTime = webhookCooldown.get(key) || 0;

    if (now - lastTime < COOLDOWN_MS) {
      return { success: false, reason: 'cooldown' };
    }

    if (!isDetectionTrigger(rawBody, contentType)) {
      return { success: false, reason: 'not_a_trigger' };
    }

    const camera = getCameraConfig(ip);
    if (!camera) {
      return { success: false, reason: 'unknown_camera' };
    }

    webhookCooldown.set(key, now);

    const imageBuffer = await fetchSnapshotUniversal(camera);
    if (!imageBuffer) {
      return { success: false, reason: 'snapshot_failed', cameraId: camera.id, cameraIp: camera.ip };
    }

    const snapshot_path = await saveSnapshotToDisk(undefined, imageBuffer);

    return {
      success: true,
      cameraId: camera.id,
      cameraIp: camera.ip,
      snapshot_path,
      timestamp: new Date().toISOString(),
      recognition: {
        snapshot_path,
        source: 'webhook_pull',
      },
    };
  } catch (error) {
    const err = error as Error;
    return { success: false, reason: 'error', message: err.message };
  }
}
