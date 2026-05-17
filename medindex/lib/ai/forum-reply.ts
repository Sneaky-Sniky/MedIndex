import type OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { completeChatWithTools } from "@/lib/ai/openai";
import { createLeafletVectorSession } from "@/lib/ai/leaflet-vector-store";
import {
  createMedicineToolRunner,
  formatFocusedMedicinesPrompt,
  MEDICINE_RAG_TOOLS,
  medicineRagInstructions,
} from "@/lib/ai/medicine-tools";
import { ragLog, ragLogTimed } from "@/lib/ai/rag-log";

const FLOW_FORUM = "rag.forum";

const FORUM_REPLY_SYSTEM = medicineRagInstructions(
  `You are a medical information assistant replying in a community forum (Romania ANMDM / medicine context).
Be concise (a few short paragraphs or bullet points). Write in the user's language as indicated.
This is a one-shot forum reply — do not ask follow-up questions or invite further chat.
Never give personal medical advice; remind the user to consult a doctor or pharmacist.`,
);

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
  return ragLogTimed(
    FLOW_FORUM,
    "generateForumReply",
    async () => {
      const leafletSession = createLeafletVectorSession();
      const runTool = createMedicineToolRunner(
        opts.openai,
        opts.supabase,
        leafletSession,
        FLOW_FORUM,
      );
      const parts = [
        `Language: ${opts.locale}`,
        "",
        buildForumReplyQuestion(opts.ctx),
      ];

      if (opts.ctx.medicineCim) {
        const focus = await formatFocusedMedicinesPrompt(opts.supabase, [
          opts.ctx.medicineCim,
        ]);
        if (focus) parts.push("", focus);
      }

      const input = parts.join("\n");
      ragLog(FLOW_FORUM, "generateForumReply · context", {
        locale: opts.locale,
        title: opts.ctx.title,
        medicineCim: opts.ctx.medicineCim,
        postCount: opts.ctx.posts.length,
        input,
      });

      const answer = await completeChatWithTools(opts.openai, {
        instructions: FORUM_REPLY_SYSTEM,
        input,
        tools: MEDICINE_RAG_TOOLS,
        runTool,
        leafletSession,
        maxOutputTokens: 1024,
        reasoningEffort: "low",
        timeoutMs: 90_000,
        logFlow: FLOW_FORUM,
      });
      return answer.trim();
    },
    {
      locale: opts.locale,
      medicineCim: opts.ctx.medicineCim,
      threadTitle: opts.ctx.title,
    },
  );
}
