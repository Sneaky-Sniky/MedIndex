import "server-only";
import type { Response } from "openai/resources/responses/responses";

const PREFIX = "[rag]";

export function isRagLogEnabled(): boolean {
  if (process.env.AI_RAG_LOG === "0") return false;
  return (
    process.env.NODE_ENV === "development" || process.env.AI_RAG_LOG === "1"
  );
}

const LOG_BODY_MAX = 12_000;

function preview(value: unknown, max = LOG_BODY_MAX): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.length <= max) return value;
    return `${value.slice(0, max)}\n… [${value.length - max} more chars]`;
  }
  try {
    const json = JSON.stringify(value);
    if (json.length <= max) return value;
    return `${json.slice(0, max)}\n… [json truncated, ${json.length} chars total]`;
  } catch {
    return String(value);
  }
}

export function ragLog(
  flow: string,
  event: string,
  data?: Record<string, unknown>,
): void {
  if (!isRagLogEnabled()) return;
  const payload = data ? { ...data } : undefined;
  if (payload) {
    for (const key of Object.keys(payload)) {
      const v = payload[key];
      if (
        typeof v === "string" ||
        (v !== null && typeof v === "object")
      ) {
        payload[key] = preview(v);
      }
    }
  }
  if (payload) {
    console.log(`${PREFIX} ${flow} · ${event}`, payload);
  } else {
    console.log(`${PREFIX} ${flow} · ${event}`);
  }
}

export function ragLogResponse(flow: string, label: string, response: Response): void {
  if (!isRagLogEnabled()) return;
  ragLog(flow, label, {
    responseId: response.id,
    status: response.status,
    model: response.model,
    outputTextChars: response.output_text?.length ?? 0,
    outputItemTypes: response.output.map((item) => item.type),
    usage: response.usage ?? null,
    error: response.error ?? null,
    incomplete: response.incomplete_details ?? null,
  });
}

export async function ragLogTimed<T>(
  flow: string,
  label: string,
  fn: () => Promise<T>,
  meta?: Record<string, unknown>,
): Promise<T> {
  if (!isRagLogEnabled()) return fn();
  const start = performance.now();
  ragLog(flow, `${label} · start`, meta);
  try {
    const result = await fn();
    ragLog(flow, `${label} · done`, {
      ...meta,
      ms: Math.round(performance.now() - start),
    });
    return result;
  } catch (e) {
    ragLog(flow, `${label} · error`, {
      ...meta,
      ms: Math.round(performance.now() - start),
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}
