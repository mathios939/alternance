/**
 * Logger structuré minimal (JSON en production, lisible en dev).
 * Compatible Edge/Serverless : pas de worker thread, pas de fichier.
 */
type Level = "debug" | "info" | "warn" | "error";
type Meta = Record<string, unknown>;

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel: Level = (process.env["LOG_LEVEL"] as Level | undefined) ?? (process.env["NODE_ENV"] === "production" ? "info" : "debug");
const isProd = process.env["NODE_ENV"] === "production";

function serializeError(err: unknown): Meta {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: isProd ? undefined : err.stack };
  }
  return { error: String(err) };
}

function write(level: Level, scope: string, message: string, meta?: Meta) {
  if (LEVELS[level] < LEVELS[minLevel]) return;
  const payload = { level, scope, message, time: new Date().toISOString(), ...meta };
  const out = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (isProd) {
    out(JSON.stringify(payload));
  } else {
    const rest = meta && Object.keys(meta).length ? meta : "";
    out(`[${level.toUpperCase()}] ${scope} — ${message}`, rest);
  }
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, meta?: Meta) => write("debug", scope, message, meta),
    info: (message: string, meta?: Meta) => write("info", scope, message, meta),
    warn: (message: string, meta?: Meta) => write("warn", scope, message, meta),
    error: (message: string, error?: unknown, meta?: Meta) =>
      write("error", scope, message, { ...meta, ...(error !== undefined ? serializeError(error) : {}) }),
  };
}

export type Logger = ReturnType<typeof createLogger>;
export const logger = createLogger("app");
