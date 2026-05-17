import OpenAI, { APIError, toFile } from "openai";
import type {
  ParsedResponse,
  Response,
  ResponseFunctionToolCall,
} from "openai/resources/responses/responses";
import type { ReasoningEffort } from "openai/resources/shared";
import {
  deleteLeafletVectorStore,
  type LeafletVectorSession,
} from "@/lib/ai/leaflet-vector-store";
import { isRagLogEnabled, ragLog, ragLogResponse } from "@/lib/ai/rag-log";

const MAX_TOOL_ROUNDS = 8;

function extractFunctionCalls(response: Response): ResponseFunctionToolCall[] {
  return response.output.filter(
    (item): item is ResponseFunctionToolCall => item.type === "function_call",
  );
}

function toolsWithLeafletSearch(
  functionTools: OpenAI.Responses.Tool[],
  session?: LeafletVectorSession | null,
): OpenAI.Responses.Tool[] {
  if (!session?.vectorStoreId) return functionTools;
  return [
    ...functionTools,
    {
      type: "file_search",
      vector_store_ids: [session.vectorStoreId],
    },
  ];
}
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
    logFlow?: string;
  },
): Promise<string> {
  const flow = opts.logFlow;
  if (flow && isRagLogEnabled()) {
    ragLog(flow, "completeChat · request", {
      model: OPENAI_CHAT_MODEL,
      fileIds: opts.fileIds ?? [],
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
      instructions: opts.instructions,
      input: opts.input,
    });
  }

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

  const t0 = performance.now();
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
  if (flow && isRagLogEnabled()) {
    ragLogResponse(flow, "completeChat · response", response);
    ragLog(flow, "completeChat · answer", {
      ms: Math.round(performance.now() - t0),
      answer: response.output_text?.trim() ?? "",
    });
  }
  return response.output_text?.trim() ?? "";
}

export async function completeChatWithTools(
  openai: OpenAI,
  opts: {
    instructions: string;
    input: string;
    tools: OpenAI.Responses.Tool[];
    runTool: (name: string, argsJson: string) => Promise<string>;
    leafletSession?: LeafletVectorSession | null;
    maxOutputTokens?: number;
    reasoningEffort?: ReasoningEffort;
    timeoutMs?: number;
    maxRounds?: number;
    logFlow?: string;
  },
): Promise<string> {
  const flow = opts.logFlow;
  const session = opts.leafletSession ?? null;
  const requestOpts = opts.timeoutMs
    ? { signal: AbortSignal.timeout(opts.timeoutMs) }
    : undefined;

  const buildBase = () => ({
    model: OPENAI_CHAT_MODEL,
    reasoning: { effort: opts.reasoningEffort ?? OPENAI_REASONING_EFFORT },
    instructions: opts.instructions,
    tools: toolsWithLeafletSearch(opts.tools, session),
    max_output_tokens: opts.maxOutputTokens ?? 2048,
  });

  if (flow && isRagLogEnabled()) {
    const base = buildBase();
    ragLog(flow, "tools · request", {
      model: base.model,
      toolNames: base.tools.map((t) =>
        t.type === "function" ? t.name : t.type,
      ),
      vectorStoreId: session?.vectorStoreId ?? null,
      maxOutputTokens: base.max_output_tokens,
      maxRounds: opts.maxRounds ?? MAX_TOOL_ROUNDS,
      instructions: opts.instructions,
      input: opts.input,
    });
  }

  const t0 = performance.now();
  try {
    let response = await openai.responses.create(
      { ...buildBase(), input: opts.input },
      requestOpts,
    );
    if (flow) ragLogResponse(flow, "tools · turn 0", response);

    const maxRounds = opts.maxRounds ?? MAX_TOOL_ROUNDS;
    for (let round = 0; round < maxRounds; round++) {
      const calls = extractFunctionCalls(response);
      if (calls.length === 0) break;

      if (flow && isRagLogEnabled()) {
        ragLog(flow, `tools · round ${round + 1} · calls`, {
          count: calls.length,
          calls: calls.map((c) => ({
            call_id: c.call_id,
            name: c.name,
            arguments: c.arguments,
          })),
        });
      }

      const outputs = await Promise.all(
        calls.map(async (call) => ({
          type: "function_call_output" as const,
          call_id: call.call_id,
          output: await opts.runTool(call.name, call.arguments),
        })),
      );

      if (flow && isRagLogEnabled()) {
        ragLog(flow, `tools · round ${round + 1} · outputs`, {
          vectorStoreId: session?.vectorStoreId ?? null,
          outputs: outputs.map((o) => ({
            call_id: o.call_id,
            output: o.output,
          })),
        });
      }

      response = await openai.responses.create(
        {
          ...buildBase(),
          previous_response_id: response.id,
          input: outputs,
        },
        requestOpts,
      );
      if (flow) ragLogResponse(flow, `tools · turn ${round + 1}`, response);
    }

    const answer = response.output_text?.trim() ?? "";
    if (flow && isRagLogEnabled()) {
      ragLog(flow, "tools · answer", {
        ms: Math.round(performance.now() - t0),
        answer,
      });
    }
    return answer;
  } finally {
    if (session) await deleteLeafletVectorStore(openai, session);
  }
}

function parseJsonResponse<T>(response: ParsedResponse<T>): T {
  const fromParsed = response.output_parsed;
  if (fromParsed != null) return fromParsed as T;

  const raw = response.output_text?.trim();
  if (!raw) {
    throw new Error(
      `Empty structured response (status=${response.status}, incomplete=${JSON.stringify(response.incomplete_details)})`,
    );
  }
  return JSON.parse(raw) as T;
}

function shouldRetryJsonResponse(response: Response, error: unknown): boolean {
  if (response.status === "incomplete") return true;
  if (error instanceof SyntaxError) return true;
  return false;
}

function buildFileInput(fileIds: string[], text: string) {
  return [
    {
      type: "message" as const,
      role: "user" as const,
      content: [
        ...fileIds.map((file_id) => ({
          type: "input_file" as const,
          file_id,
        })),
        { type: "input_text" as const, text },
      ],
    },
  ];
}

export async function completeChatJson<T>(
  openai: OpenAI,
  opts: {
    instructions: string;
    input: string;
    fileIds?: string[];
    maxOutputTokens?: number;
    reasoningEffort?: ReasoningEffort;
    schema: { name: string; schema: Record<string, unknown> };
    logFlow?: string;
  },
): Promise<T> {
  const flow = opts.logFlow;
  const fileIds = opts.fileIds ?? [];
  const input =
    fileIds.length === 0 ? opts.input : buildFileInput(fileIds, opts.input);

  const baseTokens = opts.maxOutputTokens ?? 2048;
  const tokenAttempts = [baseTokens, Math.max(baseTokens * 2, 8192)];

  let lastError: unknown;
  let lastResponse: ParsedResponse<T> | null = null;

  for (let i = 0; i < tokenAttempts.length; i++) {
    const attempt = i + 1;
    const maxOutputTokens = tokenAttempts[i]!;

    if (flow && isRagLogEnabled()) {
      ragLog(flow, "completeChatJson · request", {
        attempt,
        model: OPENAI_CHAT_MODEL,
        schema: opts.schema.name,
        fileIds,
        maxOutputTokens,
        instructions: opts.instructions,
        input: opts.input,
      });
    }

    try {
      const response = await openai.responses.parse({
        model: OPENAI_CHAT_MODEL,
        reasoning: { effort: opts.reasoningEffort ?? OPENAI_REASONING_EFFORT },
        instructions: opts.instructions,
        input,
        max_output_tokens: maxOutputTokens,
        text: {
          format: {
            type: "json_schema",
            name: opts.schema.name,
            schema: opts.schema.schema,
            strict: true,
          },
        },
      });
      lastResponse = response;

      if (flow && isRagLogEnabled()) {
        ragLogResponse(flow, `completeChatJson · response (attempt ${attempt})`, response);
      }

      const parsed = parseJsonResponse<T>(response);
      if (flow && isRagLogEnabled()) {
        ragLog(flow, "completeChatJson · parsed", { attempt, parsed });
      }
      return parsed;
    } catch (error) {
      lastError = error;
      const retry =
        lastResponse &&
        i < tokenAttempts.length - 1 &&
        shouldRetryJsonResponse(lastResponse, error);
      if (flow && isRagLogEnabled()) {
        ragLog(flow, "completeChatJson · retry", {
          attempt,
          willRetry: retry,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      if (!retry) break;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "Structured response failed"));
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
