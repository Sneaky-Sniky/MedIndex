import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateNotificationPreferences } from "@/actions/community";

type Props = { params: Promise<{ locale: string }> };

export default async function NotificationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "notifications" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("email_recalls, push_recalls")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-950">{t("title")}</h1>
      <form action={updateNotificationPreferences} className="mt-8 space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="email_recalls"
            defaultChecked={prefs?.email_recalls ?? true}
          />
          {t("emailRecalls")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="push_recalls"
            defaultChecked={prefs?.push_recalls ?? false}
          />
          {t("pushRecalls")}
        </label>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white"
        >
          {t("save")}
        </button>
      </form>
    </main>
  );
}
