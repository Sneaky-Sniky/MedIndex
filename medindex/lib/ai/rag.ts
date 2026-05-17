import type OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { completeChatJson, completeChatWithTools } from "@/lib/ai/openai";
import type { BilingualSummaries } from "@/lib/ai/summary-cache";
import {
  documentFileIds,
  documentTextContext,
  ensureMedicineLeafletsIndexed,
  fetchMedicineDocuments,
} from "@/lib/ai/documents";
import {
  createMedicineToolRunner,
  formatFocusedMedicinesPrompt,
  MEDICINE_RAG_TOOLS,
  medicineRagInstructions,
} from "@/lib/ai/medicine-tools";
import { ragLog, ragLogTimed } from "@/lib/ai/rag-log";

const FLOW_CHAT = "rag.chat";
const FLOW_SUMMARY = "rag.summary";
const FLOW_INTERACTION = "rag.interaction";

export {
  completeChat,
  completeChatJson,
  completeChatWithTools,
  createOpenAI,
  isOpenAIConfigured,
  aiRouteError,
  OPENAI_CHAT_MODEL,
  OPENAI_REASONING_EFFORT,
  uploadPdfToOpenAI,
} from "@/lib/ai/openai";

const SYSTEM = medicineRagInstructions(
  `You are a medical information assistant for Romania (ANMDM nomenclator context).
Always answer in the user's language (Romanian or Hungarian) as indicated.
Never give personal medical advice; remind the user to consult a doctor or pharmacist.`,
);

const NO_DOCS_RO =
  "Nu există prospecte indexate pentru acest medicament.";
const NO_DOCS_HU =
  "Nincs indexált betegtájékoztató ehhez a gyógyszerhez.";

async function medicineContext(
  supabase: SupabaseClient,
  medicineCim: string,
  admin?: SupabaseClient,
  logFlow?: string,
): Promise<{ fileIds: string[]; text: string }> {
  const docs = admin
    ? (await ensureMedicineLeafletsIndexed(admin, medicineCim, logFlow)).docs
    : await fetchMedicineDocuments(supabase, medicineCim);
  return {
    fileIds: documentFileIds(docs),
    text: documentTextContext(docs),
  };
}

export async function ragAnswer(opts: {
  openai: OpenAI;
  supabase: SupabaseClient;
  userQuestion: string;
  medicineCim?: string;
  answerLocale: "ro" | "hu";
  instructions?: string;
}): Promise<{ answer: string; chunkIds: string[] }> {
  return ragLogTimed(
    FLOW_CHAT,
    "ragAnswer",
    async () => {
      const instructions = opts.instructions ?? SYSTEM;
      const runTool = createMedicineToolRunner(opts.supabase, FLOW_CHAT);

      const parts = [
        `Language: ${opts.answerLocale}`,
        "",
        `Question: ${opts.userQuestion}`,
      ];

      if (opts.medicineCim) {
        const focus = await formatFocusedMedicinesPrompt(opts.supabase, [
          opts.medicineCim,
        ]);
        if (focus) parts.push("", focus);
      }

      const input = parts.join("\n");
      ragLog(FLOW_CHAT, "ragAnswer · context", {
        locale: opts.answerLocale,
        medicineCim: opts.medicineCim ?? null,
        input,
      });

      const answer =
        (await completeChatWithTools(opts.openai, {
          instructions,
          input,
          tools: MEDICINE_RAG_TOOLS,
          runTool,
          maxOutputTokens: 2048,
          logFlow: FLOW_CHAT,
        })) || "Nu am putut genera un răspuns.";
      return { answer, chunkIds: [] };
    },
    {
      locale: opts.answerLocale,
      medicineCim: opts.medicineCim ?? null,
      questionChars: opts.userQuestion.length,
    },
  );
}

const SUMMARY_JSON_SCHEMA = {
  type: "object",
  properties: {
    ro: {
      type: "string",
      description:
        "Romanian summary in markdown: bullets with - and section labels with **",
    },
    hu: {
      type: "string",
      description:
        "Hungarian summary in markdown: bullets with - and section labels with **",
    },
  },
  required: ["ro", "hu"],
  additionalProperties: false,
} as const;

const SUMMARY_INSTRUCTIONS = `You write fixed informational summaries for a medicine product page — not a chat.
Return JSON only with keys "ro" and "hu".
Each value is a complete summary in that language: bullet points for dosage, contraindications, and adverse effects.
Use markdown inside each string: "- " for bullets and **Heading** for section labels.
Use only the attached official documents. If information is missing, write "unknown in excerpts".
Do not ask questions, suggest follow-ups, or address the reader.`;

export async function summarizeLeafletsBilingual(opts: {
  openai: OpenAI;
  supabase: SupabaseClient;
  admin?: SupabaseClient;
  medicineCim: string;
}): Promise<BilingualSummaries> {
  return ragLogTimed(
    FLOW_SUMMARY,
    "summarizeLeafletsBilingual",
    async () => {
      const { fileIds, text } = await medicineContext(
        opts.supabase,
        opts.medicineCim,
        opts.admin,
        FLOW_SUMMARY,
      );
      const usePdfAttachments = fileIds.length > 0;
      ragLog(FLOW_SUMMARY, "documents loaded", {
        medicineCim: opts.medicineCim,
        fileIds,
        pdfAttachments: usePdfAttachments,
        excerptChars: text.length,
        textInPrompt: !usePdfAttachments && Boolean(text),
      });
      if (!usePdfAttachments && !text) {
        return { ro: NO_DOCS_RO, hu: NO_DOCS_HU };
      }

      const parsed = await completeChatJson<{ ro: string; hu: string }>(
        opts.openai,
        {
          instructions: SUMMARY_INSTRUCTIONS,
          input: usePdfAttachments
            ? "Summarize the attached official medicine documents (RCP / prospect) in Romanian and Hungarian."
            : text,
          fileIds: usePdfAttachments ? fileIds : undefined,
          maxOutputTokens: 4096,
          schema: { name: "medicine_summaries", schema: SUMMARY_JSON_SCHEMA },
          logFlow: FLOW_SUMMARY,
        },
      );

      return {
        ro: parsed.ro?.trim() || "—",
        hu: parsed.hu?.trim() || "—",
      };
    },
    { medicineCim: opts.medicineCim },
  );
}

const INTERACTION_INSTRUCTIONS = medicineRagInstructions(
  `You produce a one-shot drug interaction report for a medicine basket — this is NOT a chat.
Analyze the complete basket together; consider cross-medicine interactions across the full set.
Describe possible interaction concerns conservatively; use uncertainty language.
Write in the user's language as indicated.
Output a structured report in markdown (**section headings**, bullet points).
Do NOT ask questions, invite follow-ups, greet the user, or add conversational closings.
Do not give personal medical advice; remind the user to consult a doctor or pharmacist.`,
);

export async function interactionAnalysis(opts: {
  openai: OpenAI;
  supabase: SupabaseClient;
  medicineCims: string[];
  locale: "ro" | "hu";
}): Promise<string> {
  return ragLogTimed(
    FLOW_INTERACTION,
    "interactionAnalysis",
    async () => {
      const runTool = createMedicineToolRunner(opts.supabase, FLOW_INTERACTION);
      const focus = await formatFocusedMedicinesPrompt(
        opts.supabase,
        opts.medicineCims,
      );

      const input = [
        `Language: ${opts.locale}`,
        "",
        `Medicines in basket (${opts.medicineCims.length}): ${opts.medicineCims.join(", ")}`,
        "",
        focus,
        "",
        "Load official leaflet excerpts for each basket medicine via tools, then write the interaction report.",
      ].join("\n");

      ragLog(FLOW_INTERACTION, "interactionAnalysis · context", {
        locale: opts.locale,
        medicineCims: opts.medicineCims,
        input,
      });

      return (
        (await completeChatWithTools(opts.openai, {
          instructions: INTERACTION_INSTRUCTIONS,
          input,
          tools: MEDICINE_RAG_TOOLS,
          runTool,
          maxOutputTokens: 4096,
          logFlow: FLOW_INTERACTION,
        })) || "—"
      );
    },
    { locale: opts.locale, basketSize: opts.medicineCims.length },
  );
}
