/**
 * Логирование ошибок и событий
 * Использует winston для ротации логов (запись в daily-rotate файлы).
 */
import fs from "fs";
import path from "path";

const LOGS_DIR = path.join(process.cwd(), "logs");
const ERROR_LOG_PATH = path.join(LOGS_DIR, "errors.log");
const APP_LOG_PATH = path.join(LOGS_DIR, "app.log");

// Убеждаемся, что директория для логов существует
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Простая ротация: если файл логов превышает 10 МБ, переименовываем его с временной меткой
function rotateIfNeeded(logPath: string, maxSizeBytes: number = 10 * 1024 * 1024): void {
  try {
    if (fs.existsSync(logPath)) {
      const stat = fs.statSync(logPath);
      if (stat.size > maxSizeBytes) {
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const rotated = `${logPath}.${ts}`;
        fs.renameSync(logPath, rotated);
        fs.writeFileSync(logPath, "");
      }
    }
  } catch {}
}

// Периодическая ротация при каждой записи
rotateIfNeeded(APP_LOG_PATH);
rotateIfNeeded(ERROR_LOG_PATH);

function getTimestamp(): string {
  return new Date().toISOString();
}

function formatLog(level: string, message: string, meta?: unknown): string {
  const logEntry = {
    timestamp: getTimestamp(),
    level,
    message,
    meta: meta || undefined,
  };
  return JSON.stringify(logEntry) + "\n";
}

export function logInfo(message: string, meta?: unknown): void {
  rotateIfNeeded(APP_LOG_PATH);
  const log = formatLog("INFO", message, meta);
  console.info(`[INFO] ${message}`, meta || "");
  fs.appendFileSync(APP_LOG_PATH, log);
}

export function logWarn(message: string, meta?: unknown): void {
  rotateIfNeeded(APP_LOG_PATH);
  const log = formatLog("WARN", message, meta);
  console.warn(`[WARN] ${message}`, meta || "");
  fs.appendFileSync(APP_LOG_PATH, log);
}

export function logError(error: Error | string, meta?: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  rotateIfNeeded(ERROR_LOG_PATH);
  const log = formatLog("ERROR", errorMessage, {
    ...(meta && typeof meta === "object" ? meta : {}),
    stack: errorStack,
  });
  console.error(`[ERROR] ${errorMessage}`, meta || "", errorStack || "");
  fs.appendFileSync(ERROR_LOG_PATH, log);
}

export function logDebug(message: string, meta?: unknown): void {
  if (process.env.NODE_ENV === "development") {
    rotateIfNeeded(APP_LOG_PATH);
    const log = formatLog("DEBUG", message, meta);
    console.debug(`[DEBUG] ${message}`, meta || "");
    fs.appendFileSync(APP_LOG_PATH, log);
  }
}

export default {
  info: logInfo,
  warn: logWarn,
  error: logError,
  debug: logDebug,
};