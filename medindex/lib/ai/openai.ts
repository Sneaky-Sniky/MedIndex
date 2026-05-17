import OpenAI, { APIError, toFile } from "openai";
import type {
  Response,
  ResponseFunctionToolCall,
} from "openai/resources/responses/responses";
import type { ReasoningEffort } from "openai/resources/shared";
import { isRagLogEnabled, ragLog, ragLogResponse } from "@/lib/ai/rag-log";

const MAX_TOOL_ROUNDS = 8;

function extractFunctionCalls(response: Response): ResponseFunctionToolCall[] {
  return response.output.filter(
    (item): item is ResponseFunctionToolCall => item.type === "function_call",
  );
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
    maxOutputTokens?: number;
    reasoningEffort?: ReasoningEffort;
    timeoutMs?: number;
    maxRounds?: number;
    logFlow?: string;
  },
): Promise<string> {
  const flow = opts.logFlow;
  const requestOpts = opts.timeoutMs
    ? { signal: AbortSignal.timeout(opts.timeoutMs) }
    : undefined;
  const base = {
    model: OPENAI_CHAT_MODEL,
    reasoning: { effort: opts.reasoningEffort ?? OPENAI_REASONING_EFFORT },
    instructions: opts.instructions,
    tools: opts.tools,
    max_output_tokens: opts.maxOutputTokens ?? 2048,
  };

  if (flow && isRagLogEnabled()) {
    ragLog(flow, "tools · request", {
      model: base.model,
      toolNames: opts.tools
        .filter((t) => t.type === "function")
        .map((t) => t.name),
      maxOutputTokens: base.max_output_tokens,
      maxRounds: opts.maxRounds ?? MAX_TOOL_ROUNDS,
      instructions: opts.instructions,
      input: opts.input,
    });
  }

  const t0 = performance.now();
  let response = await openai.responses.create(
    { ...base, input: opts.input },
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
        outputs: outputs.map((o) => ({
          call_id: o.call_id,
          output: o.output,
        })),
      });
    }

    response = await openai.responses.create(
      {
        ...base,
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
}

export async function completeChatJson<T>(
  openai: OpenAI,
  opts: {
    instructions: string;
    input: string;
    fileIds?: string[];
    maxOutputTokens?: number;
    schema: { name: string; schema: Record<string, unknown> };
    logFlow?: string;
  },
): Promise<T> {
  const flow = opts.logFlow;
  if (flow && isRagLogEnabled()) {
    ragLog(flow, "completeChatJson · request", {
      model: OPENAI_CHAT_MODEL,
      schema: opts.schema.name,
      fileIds: opts.fileIds ?? [],
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
  const parsed = JSON.parse(raw) as T;
  if (flow && isRagLogEnabled()) {
    ragLogResponse(flow, "completeChatJson · response", response);
    ragLog(flow, "completeChatJson · parsed", {
      ms: Math.round(performance.now() - t0),
      parsed,
    });
  }
  return parsed;
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
