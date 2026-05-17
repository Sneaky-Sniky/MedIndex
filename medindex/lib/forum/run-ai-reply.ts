import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOpenAI } from "@/lib/ai/openai";
import { generateForumReply } from "@/lib/ai/forum-reply";

export type ForumAiReplyParams = {
  threadId: string;
  locale: "ro" | "hu";
};

export async function runForumAiReplyJob(
  params: ForumAiReplyParams,
): Promise<{ ok: boolean; reason?: string }> {
  const openai = createOpenAI();
  if (!openai) return { ok: false, reason: "openai_not_configured" };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, reason: "admin_client_unavailable" };
  }

  const { data: thread } = await admin
    .from("forum_threads")
    .select("title, medicine_cim")
    .eq("id", params.threadId)
    .maybeSingle();

  if (!thread) return { ok: false, reason: "thread_missing" };

  const { count } = await admin
    .from("forum_posts")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", params.threadId);

  if ((count ?? 0) > 0) {
    return { ok: false, reason: "thread_already_has_posts" };
  }

  let answer: string;
  try {
    answer = await generateForumReply({
      openai,
      supabase: admin,
      locale: params.locale,
      ctx: {
        title: thread.title,
        medicineCim: thread.medicine_cim,
        posts: [],
        latestPostBody: thread.title,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "generate_failed";
    console.error("forum ai reply generate:", msg);
    return { ok: false, reason: "generate_failed" };
  }

  if (!answer) return { ok: false, reason: "empty_answer" };

  const { error } = await admin.from("forum_posts").insert({
    thread_id: params.threadId,
    user_id: null,
    body: answer,
    is_ai_draft: true,
  });

  if (error) {
    console.error("forum_ai_reply insert:", error.message);
    return { ok: false, reason: "insert_failed" };
  }

  return { ok: true };
}
