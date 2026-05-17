import OpenAI, { APIError, toFile } from "openai";
import type { ReasoningEffort } from "openai/resources/shared";
/** Chat / completion (reasoning). */
export const OPENAI_CHAT_MODEL =
  process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-5.4-mini";

export const OPENAI_REASONING_EFFORT: ReasoningEffort =
  (process.env.OPENAI_REASONING_EFFORT?.trim() as ReasoningEffort) || "medium";

export async function completeChat(
  openai: OpenAI,
  opts: {
    instructions: string;
    input: string;
    fileIds?: string[];
    maxOutputTokens?: number;
    reasoningEffort?: ReasoningEffort;
    timeoutMs?: number;
  },
): Promise<string> {
  const fileIds = opts.fileIds ?? [];
  const input =
    fileIds.length === 0
      ? opts.input
      : [
          {
            type: "message" as const,
            role: "user" as const,
            content: [
              ...fileIds.map((file_id) => ({
                type: "input_file" as const,
                file_id,
              })),
              { type: "input_text" as const, text: opts.input },
            ],
          },
        ];

  const response = await openai.responses.create(
    {
      model: OPENAI_CHAT_MODEL,
      reasoning: { effort: opts.reasoningEffort ?? OPENAI_REASONING_EFFORT },
      instructions: opts.instructions,
      input,
      max_output_tokens: opts.maxOutputTokens ?? 2048,
    },
    opts.timeoutMs ? { signal: AbortSignal.timeout(opts.timeoutMs) } : undefined,
  );
  return response.output_text?.trim() ?? "";
}

export async function completeChatJson<T>(
  openai: OpenAI,
  opts: {
    instructions: string;
    input: string;
    fileIds?: string[];
    maxOutputTokens?: number;
    schema: { name: string; schema: Record<string, unknown> };
  },
): Promise<T> {
  const fileIds = opts.fileIds ?? [];
  const input =
    fileIds.length === 0
      ? opts.input
      : [
          {
            type: "message" as const,
            role: "user" as const,
            content: [
              ...fileIds.map((file_id) => ({
                type: "input_file" as const,
                file_id,
              })),
              { type: "input_text" as const, text: opts.input },
            ],
          },
        ];

  const response = await openai.responses.create({
    model: OPENAI_CHAT_MODEL,
    reasoning: { effort: OPENAI_REASONING_EFFORT },
    instructions: opts.instructions,
    input,
    max_output_tokens: opts.maxOutputTokens ?? 2048,
    text: {
      format: {
        type: "json_schema",
        name: opts.schema.name,
        schema: opts.schema.schema,
        strict: true,
      },
    },
  });

  const raw = response.output_text?.trim() ?? "{}";
  return JSON.parse(raw) as T;
}

export async function uploadPdfToOpenAI(
  openai: OpenAI,
  buffer: ArrayBuffer,
  filename: string,
): Promise<string> {
  const file = await toFile(Buffer.from(buffer), filename, {
    type: "application/pdf",
  });
  const uploaded = await openai.files.create({
    file,
    purpose: "user_data",
  });
  return uploaded.id;
}

export function createOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function aiRouteError(e: unknown): { status: number; error: string } {
  if (e instanceof APIError) {
    if (e.status === 401) {
      return { status: 503, error: "Invalid OPENAI_API_KEY." };
    }
    if (e.status === 429) {
      return {
        status: 503,
        error:
          "OpenAI quota exceeded. Add billing or credits at platform.openai.com.",
      };
    }
    return { status: 502, error: e.message };
  }
  return {
    status: 500,
    error: e instanceof Error ? e.message : "Request failed",
  };
}
