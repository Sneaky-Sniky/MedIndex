import type OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { completeChat, completeChatJson } from "@/lib/ai/openai";
import type { BilingualSummaries } from "@/lib/ai/summary-cache";
import {
  documentFileIds,
  documentTextContext,
  fetchMedicineDocuments,
  type MedicineDocumentRow,
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
  instructions?: string;
}): Promise<{ answer: string; chunkIds: string[] }> {
  const instructions = opts.instructions ?? SYSTEM;
  if (!opts.medicineCim) {
    const answer =
      (await completeChat(opts.openai, {
        instructions,
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
      instructions,
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

const INTERACTION_INSTRUCTIONS = `You produce a one-shot drug interaction report for a medicine basket — this is NOT a chat.
Use ONLY the provided official leaflet documents and full excerpts for EVERY medicine listed below and in the attached PDFs.
Analyze the complete basket together; consider cross-medicine interactions across the full set.
Describe possible interaction concerns conservatively; use uncertainty language.
Write in the user's language as indicated.
Output a structured report in markdown (**section headings**, bullet points).
Do NOT ask questions, invite follow-ups, greet the user, or add conversational closings (e.g. "let me know", "feel free to ask", "if you have questions").
Do not give personal medical advice; remind the user to consult a doctor or pharmacist.`;

function medicineInteractionSection(
  cim: string,
  docs: MedicineDocumentRow[],
): string {
  if (docs.length === 0) {
    return `Medicine CIM ${cim}:\n(no indexed documents)`;
  }
  const blocks = docs.map((d) => {
    const header = `[${d.doc_type}]`;
    if (d.extracted_text?.trim()) {
      const pdfNote = d.openai_file_id?.trim()
        ? " (full PDF also attached)"
        : "";
      return `${header}${pdfNote}\n${d.extracted_text.trim()}`;
    }
    if (d.openai_file_id?.trim()) {
      return `${header}\n(full document text is in the attached PDF for this product)`;
    }
    return `${header}\n(no indexed content)`;
  });
  return `Medicine CIM ${cim} (${docs.length} document(s)):\n\n${blocks.join("\n\n---\n\n")}`;
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
    const docs = await fetchMedicineDocuments(opts.supabase, cim);
    allFileIds.push(...documentFileIds(docs));
    sections.push(medicineInteractionSection(cim, docs));
  }

  const uniqueFileIds = [...new Set(allFileIds)];
  const hasContent =
    uniqueFileIds.length > 0 ||
    sections.some((s) => !s.includes("(no indexed documents)"));

  if (!hasContent) {
    return opts.locale === "hu" ? NO_DOCS_HU : NO_DOCS_RO;
  }

  return (
    (await completeChat(opts.openai, {
      instructions: `${INTERACTION_INSTRUCTIONS}\n\nLanguage: ${opts.locale}.`,
      input: `Medicines in basket (${opts.medicineCims.length}): ${opts.medicineCims.join(", ")}\n\n${sections.join("\n\n=====\n\n")}`,
      fileIds: uniqueFileIds,
      maxOutputTokens: 4096,
    })) || "—"
  );
}
