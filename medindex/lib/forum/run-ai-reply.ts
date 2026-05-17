import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOpenAI } from "@/lib/ai/openai";
import { generateForumReply } from "@/lib/ai/forum-reply";

export type ForumAiReplyParams = {
  threadId: string;
  triggerPostId: string;
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

  const { data: triggerPost } = await admin
    .from("forum_posts")
    .select("id, body, is_ai_draft, thread_id")
    .eq("id", params.triggerPostId)
    .maybeSingle();

  if (!triggerPost || triggerPost.thread_id !== params.threadId) {
    return { ok: false, reason: "trigger_post_missing" };
  }
  if (triggerPost.is_ai_draft) {
    return { ok: false, reason: "trigger_is_ai" };
  }

  const { data: latest } = await admin
    .from("forum_posts")
    .select("id")
    .eq("thread_id", params.threadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest?.id !== params.triggerPostId) {
    return { ok: false, reason: "stale_trigger" };
  }

  const { data: thread } = await admin
    .from("forum_threads")
    .select("title, medicine_cim")
    .eq("id", params.threadId)
    .maybeSingle();

  if (!thread) return { ok: false, reason: "thread_missing" };

  const { data: posts } = await admin
    .from("forum_posts")
    .select("body, is_ai_draft")
    .eq("thread_id", params.threadId)
    .order("created_at", { ascending: true })
    .limit(30);

  const postRows = posts ?? [];
  let answer: string;
  try {
    answer = await generateForumReply({
      openai,
      supabase: admin,
      locale: params.locale,
      ctx: {
        title: thread.title,
        medicineCim: thread.medicine_cim,
        posts: postRows.map((p) => ({ body: p.body, isAi: p.is_ai_draft })),
        latestPostBody: triggerPost.body,
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

  revalidatePath(`/${params.locale}/forum/${params.threadId}`);
  revalidatePath(`/${params.locale}/forum`);

  return { ok: true };
}
