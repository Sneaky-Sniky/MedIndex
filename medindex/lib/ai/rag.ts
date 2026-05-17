import type OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { completeChat, completeChatJson } from "@/lib/ai/openai";
import type { BilingualSummaries } from "@/lib/ai/summary-cache";
import {
  documentFileIds,
  documentTextContext,
  fetchMedicineDocuments,
} from "@/lib/ai/documents";

export {
  completeChat,
  completeChatJson,
  createOpenAI,
  isOpenAIConfigured,
  aiRouteError,
  OPENAI_CHAT_MODEL,
  OPENAI_REASONING_EFFORT,
  uploadPdfToOpenAI,
} from "@/lib/ai/openai";

const SYSTEM = `You are a medical information assistant for Romania (ANMDM nomenclator context).
Answer ONLY using the provided official leaflet documents or excerpts. If the answer is not in the documents, say you do not have that information in the official excerpts.
Always answer in the user's language (Romanian or Hungarian) as indicated.
Never give personal medical advice; remind the user to consult a doctor or pharmacist.`;

const NO_DOCS_RO =
  "Nu există prospecte indexate pentru acest medicament.";
const NO_DOCS_HU =
  "Nincs indexált betegtájékoztató ehhez a gyógyszerhez.";

async function medicineContext(
  supabase: SupabaseClient,
  medicineCim: string,
): Promise<{ fileIds: string[]; text: string }> {
  const docs = await fetchMedicineDocuments(supabase, medicineCim);
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
}): Promise<{ answer: string; chunkIds: string[] }> {
  if (!opts.medicineCim) {
    const answer =
      (await completeChat(opts.openai, {
        instructions: SYSTEM,
        input: `Language: ${opts.answerLocale}\n\nQuestion: ${opts.userQuestion}`,
        maxOutputTokens: 2048,
      })) || "Nu am putut genera un răspuns.";
    return { answer, chunkIds: [] };
  }

  const { fileIds, text } = await medicineContext(opts.supabase, opts.medicineCim);
  if (fileIds.length === 0 && !text) {
    return {
      answer: opts.answerLocale === "hu" ? NO_DOCS_HU : NO_DOCS_RO,
      chunkIds: [],
    };
  }

  const prompt = `Language: ${opts.answerLocale}\n\nQuestion: ${opts.userQuestion}${
    text ? `\n\nReference excerpts:\n${text}` : ""
  }`;

  const answer =
    (await completeChat(opts.openai, {
      instructions: SYSTEM,
      input: prompt,
      fileIds,
      maxOutputTokens: 2048,
    })) || "Nu am putut genera un răspuns.";
  return { answer, chunkIds: [] };
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
  medicineCim: string;
}): Promise<BilingualSummaries> {
  const { fileIds, text } = await medicineContext(opts.supabase, opts.medicineCim);
  if (fileIds.length === 0 && !text) {
    return { ro: NO_DOCS_RO, hu: NO_DOCS_HU };
  }

  const parsed = await completeChatJson<{ ro: string; hu: string }>(opts.openai, {
    instructions: SUMMARY_INSTRUCTIONS,
    input:
      text ||
      "Summarize the attached official medicine documents (RCP / prospect) in Romanian and Hungarian.",
    fileIds,
    maxOutputTokens: 4096,
    schema: { name: "medicine_summaries", schema: SUMMARY_JSON_SCHEMA },
  });

  return {
    ro: parsed.ro?.trim() || "—",
    hu: parsed.hu?.trim() || "—",
  };
}

export async function interactionAnalysis(opts: {
  openai: OpenAI;
  supabase: SupabaseClient;
  medicineCims: string[];
  locale: "ro" | "hu";
}): Promise<string> {
  const sections: string[] = [];
  const allFileIds: string[] = [];

  for (const cim of opts.medicineCims) {
    const { fileIds, text } = await medicineContext(opts.supabase, cim);
    allFileIds.push(...fileIds);
    if (text) {
      sections.push(`Medicine ${cim}:\n${text}`);
    } else if (fileIds.length > 0) {
      sections.push(`Medicine ${cim}: (see attached PDF files for this product)`);
    }
  }

  if (allFileIds.length === 0 && sections.length === 0) {
    return opts.locale === "hu" ? NO_DOCS_HU : NO_DOCS_RO;
  }

  return (
    (await completeChat(opts.openai, {
      instructions: `You analyze only the provided official leaflet documents for multiple medicines. Describe possible interaction concerns conservatively; use uncertainty language. Language: ${opts.locale}. Not medical advice.`,
      input:
        sections.join("\n\n=====\n\n") ||
        "Analyze possible interactions between the attached medicine documents.",
      fileIds: [...new Set(allFileIds)],
      maxOutputTokens: 2048,
    })) || "—"
  );
}
