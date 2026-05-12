import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export function formatVector(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

export async function embedText(
  openai: OpenAI,
  text: string,
): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    dimensions: 1536,
    input: text,
  });
  return res.data[0]!.embedding as number[];
}

export async function retrieveChunks(
  supabase: SupabaseClient,
  queryEmbedding: number[],
  opts: { medicineCim?: string; k?: number },
) {
  const vec = formatVector(queryEmbedding);
  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: vec,
    match_count: opts.k ?? 8,
    filter_medicine_cim: opts.medicineCim ?? null,
  });
  if (error) throw error;
  return (data ?? []) as {
    id: string;
    medicine_cim: string;
    content: string;
    similarity: number;
  }[];
}

const SYSTEM = `You are a medical information assistant for Romania (ANMDM nomenclator context).
Answer ONLY using the provided excerpt context. If the answer is not in the context, say you do not have that information in the official excerpts.
Always answer in the user's language (Romanian or Hungarian) as indicated.
Never give personal medical advice; remind the user to consult a doctor or pharmacist.`;

export async function ragAnswer(opts: {
  openai: OpenAI;
  supabase: SupabaseClient;
  userQuestion: string;
  medicineCim?: string;
  answerLocale: "ro" | "hu";
}): Promise<{ answer: string; chunkIds: string[] }> {
  const qEmb = await embedText(opts.openai, opts.userQuestion);
  const chunks = await retrieveChunks(opts.supabase, qEmb, {
    medicineCim: opts.medicineCim,
    k: 10,
  });
  const context = chunks.map((c) => `[${c.id}] ${c.content}`).join("\n---\n");
  const completion = await opts.openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Language: ${opts.answerLocale}\n\nContext:\n${context}\n\nQuestion: ${opts.userQuestion}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 800,
  });
  const answer =
    completion.choices[0]?.message?.content?.trim() ??
    "Nu am putut genera un răspuns.";
  return { answer, chunkIds: chunks.map((c) => c.id) };
}

export async function summarizeLeaflets(opts: {
  openai: OpenAI;
  supabase: SupabaseClient;
  medicineCim: string;
  locale: "ro" | "hu";
}): Promise<string> {
  const qEmb = await embedText(
    opts.openai,
    "dosage contraindications adverse effects summary patient leaflet",
  );
  const chunks = await retrieveChunks(opts.supabase, qEmb, {
    medicineCim: opts.medicineCim,
    k: 12,
  });
  if (chunks.length === 0) {
    return opts.locale === "hu"
      ? "Nincs elérhető szövegrészlet a dokumentumokból."
      : "Nu există fragmente indexate din prospect pentru acest medicament.";
  }
  const context = chunks.map((c) => c.content).join("\n---\n");
  const completion = await opts.openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Extract key bullet points: dosage, contraindications, adverse effects. Language: ${opts.locale}. Only from context. If missing, say "unknown in excerpts".`,
      },
      { role: "user", content: context },
    ],
    temperature: 0.1,
    max_tokens: 900,
  });
  return (
    completion.choices[0]?.message?.content?.trim() ??
    "—"
  );
}

export async function interactionAnalysis(opts: {
  openai: OpenAI;
  supabase: SupabaseClient;
  medicineCims: string[];
  locale: "ro" | "hu";
}): Promise<string> {
  const all: string[] = [];
  for (const cim of opts.medicineCims) {
    const emb = await embedText(opts.openai, `drug interactions contraindications ${cim}`);
    const chunks = await retrieveChunks(opts.supabase, emb, {
      medicineCim: cim,
      k: 6,
    });
    all.push(`Medicine ${cim}:\n${chunks.map((c) => c.content).join("\n")}`);
  }
  const completion = await opts.openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You analyze only the provided official leaflet excerpts for multiple medicines. Describe possible interaction concerns conservatively; use uncertainty language. Language: ${opts.locale}. Not medical advice.`,
      },
      { role: "user", content: all.join("\n\n=====\n\n") },
    ],
    temperature: 0.1,
    max_tokens: 1000,
  });
  return (
    completion.choices[0]?.message?.content?.trim() ?? "—"
  );
}
