import type OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { completeChat } from "@/lib/ai/openai";
import { documentTextContext, fetchMedicineDocuments } from "@/lib/ai/documents";

const FORUM_REPLY_SYSTEM = `You are a medical information assistant replying in a community forum (Romania ANMDM / medicine context).
Answer the user's forum post using official leaflet excerpts when provided.
Be concise (a few short paragraphs or bullet points). Write in the user's language as indicated.
This is a one-shot forum reply — do not ask follow-up questions or invite further chat.
Never give personal medical advice; remind the user to consult a doctor or pharmacist.`;

const NO_DOCS_RO =
  "Nu există prospecte indexate pentru acest medicament.";
const NO_DOCS_HU =
  "Nincs indexált betegtájékoztató ehhez a gyógyszerhez.";

export type ForumThreadContext = {
  title: string;
  medicineCim: string | null;
  posts: { body: string; isAi: boolean }[];
  latestPostBody: string;
};

export function buildForumReplyQuestion(ctx: ForumThreadContext): string {
  const lines = [`Thread: ${ctx.title}`];
  if (ctx.medicineCim) lines.push(`Medicine CIM: ${ctx.medicineCim}`);
  if (ctx.posts.length > 1) {
    lines.push("", "Earlier posts:");
    for (const p of ctx.posts.slice(0, -1)) {
      lines.push(`${p.isAi ? "[AI]" : "[User]"}: ${p.body}`);
    }
  }
  lines.push("", "Latest post to answer:", ctx.latestPostBody);
  return lines.join("\n");
}

export async function generateForumReply(opts: {
  openai: OpenAI;
  supabase: SupabaseClient;
  ctx: ForumThreadContext;
  locale: "ro" | "hu";
}): Promise<string> {
  let prompt = `Language: ${opts.locale}\n\n${buildForumReplyQuestion(opts.ctx)}`;

  if (opts.ctx.medicineCim) {
    const docs = await fetchMedicineDocuments(opts.supabase, opts.ctx.medicineCim);
    const text = documentTextContext(docs);
    if (!text) {
      return opts.locale === "hu" ? NO_DOCS_HU : NO_DOCS_RO;
    }
    prompt += `\n\nReference excerpts:\n${text}`;
  }

  const answer = await completeChat(opts.openai, {
    instructions: FORUM_REPLY_SYSTEM,
    input: prompt,
    maxOutputTokens: 1024,
    reasoningEffort: "low",
    timeoutMs: 90_000,
  });
  return answer.trim();
}
