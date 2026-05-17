"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runForumAiReplyJob } from "@/lib/forum/run-ai-reply";

export async function submitReview(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const medicine_cim = String(formData.get("cim") ?? "");
  const rating = Number(formData.get("rating") ?? 0);
  const body = String(formData.get("body") ?? "");
  const locale = String(formData.get("locale") ?? "ro");
  const slug = String(formData.get("slug") ?? "");

  if (!medicine_cim || rating < 1 || rating > 5) return;

  const { error } = await supabase.from("reviews").insert({
    medicine_cim,
    user_id: user.id,
    rating,
    body,
  });
  if (error) return;

  revalidatePath(`/${locale}/medicine/${slug}`);
}

export async function submitErrorReport(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const medicine_cim = String(formData.get("cim") ?? "") || null;
  const message = String(formData.get("message") ?? "").trim();
  const locale = String(formData.get("locale") ?? "ro");
  const slug = String(formData.get("slug") ?? "");

  if (!message) return;

  const { error } = await supabase.from("error_reports").insert({
    medicine_cim,
    user_id: user.id,
    message,
  });
  if (error) return;

  if (slug) revalidatePath(`/${locale}/medicine/${slug}`);
}

export async function adminRunAnmSync() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "auth" as const };

  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (prof?.role !== "admin") return { error: "forbidden" as const };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { runAnmIngest } = await import("@/lib/ingest/sync");
  const admin = createAdminClient();
  const result = await runAnmIngest(admin);
  revalidatePath("/ro/admin");
  revalidatePath("/hu/admin");
  return { ok: true as const, result };
}

export async function createForumThread(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const title = String(formData.get("title") ?? "").trim();
  const medicine_cim = String(formData.get("medicine_cim") ?? "").trim() || null;
  const locale = String(formData.get("locale") ?? "ro");

  if (!title) return;

  const { data: thread, error } = await supabase
    .from("forum_threads")
    .insert({
      title,
      medicine_cim,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !thread) return;

  revalidatePath(`/${locale}/forum`);
  redirect(`/${locale}/forum/${thread.id}`);
}

export async function createForumPost(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const thread_id = String(formData.get("thread_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const locale = String(formData.get("locale") ?? "ro");

  if (!thread_id || !body) return;

  const { data: post, error } = await supabase
    .from("forum_posts")
    .insert({
      thread_id,
      user_id: user.id,
      body,
      is_ai_draft: false,
    })
    .select("id")
    .single();
  if (error || !post) return;

  revalidatePath(`/${locale}/forum/${thread_id}`);

  const answerLocale = locale === "hu" ? "hu" : "ro";
  after(async () => {
    const result = await runForumAiReplyJob({
      threadId: thread_id,
      triggerPostId: post.id,
      locale: answerLocale,
    });
    if (!result.ok) {
      console.warn("forum ai reply skipped:", result.reason);
    }
  });
}

export async function voteForumPost(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const post_id = String(formData.get("post_id") ?? "");
  const thread_id = String(formData.get("thread_id") ?? "");
  const locale = String(formData.get("locale") ?? "ro");
  const voteRaw = String(formData.get("vote") ?? "");
  const vote = Number(voteRaw);
  if (!post_id || !thread_id || (vote !== 1 && vote !== -1)) return;

  const { error } = await supabase.from("forum_post_votes").upsert(
    { post_id, user_id: user.id, vote },
    { onConflict: "post_id,user_id" },
  );
  if (error) return;

  revalidatePath(`/${locale}/forum/${thread_id}`);
}

export async function updateNotificationPreferences(
  formData: FormData,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const email_recalls = formData.get("email_recalls") === "on";
  const push_recalls = formData.get("push_recalls") === "on";
  const locale = String(formData.get("locale") ?? "ro");

  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: user.id,
      email_recalls,
      push_recalls,
    },
    { onConflict: "user_id" },
  );
  if (error) return;

  revalidatePath(`/${locale}/account/notifications`);
}

export async function subscribeToMedicine(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const medicine_cim = String(formData.get("cim") ?? "");
  const locale = String(formData.get("locale") ?? "ro");
  const slug = String(formData.get("slug") ?? "");
  if (!medicine_cim) return;

  const { error } = await supabase.from("medicine_subscriptions").upsert(
    { user_id: user.id, medicine_cim },
    { onConflict: "user_id,medicine_cim" },
  );
  if (error) return;

  revalidatePath(`/${locale}/medicine/${slug}`);
  revalidatePath(`/${locale}/account/notifications`);
}

export async function unsubscribeFromMedicine(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const medicine_cim = String(formData.get("cim") ?? "");
  const locale = String(formData.get("locale") ?? "ro");
  const slug = String(formData.get("slug") ?? "");
  if (!medicine_cim) return;

  const { error } = await supabase
    .from("medicine_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("medicine_cim", medicine_cim);
  if (error) return;

  if (slug) revalidatePath(`/${locale}/medicine/${slug}`);
  revalidatePath(`/${locale}/account/notifications`);
}
