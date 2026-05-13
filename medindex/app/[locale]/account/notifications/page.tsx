import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { unsubscribeFromMedicine, updateNotificationPreferences } from "@/actions/community";

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

  const { data: followed } = await supabase
    .from("medicine_subscriptions")
    .select("medicine_cim, medicines (den_comerciala, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-950">{t("title")}</h1>
      <section className="mt-10">
        <h2 className="text-lg font-medium text-zinc-950">{t("followedMedicines")}</h2>
        {!followed?.length ? (
          <p className="mt-2 text-sm text-zinc-600">{t("noFollowedMedicines")}</p>
        ) : (
          <ul className="mt-3 divide-y rounded-lg border border-zinc-200 bg-white">
            {followed.map((row) => {
              const raw = row.medicines;
              const med = (Array.isArray(raw) ? raw[0] : raw) as
                | { den_comerciala: string; slug: string }
                | null
                | undefined;
              if (!med) return null;
              return (
                <li
                  key={row.medicine_cim}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <Link
                    href={`/medicine/${med.slug}`}
                    className="text-zinc-900 underline decoration-zinc-300 hover:decoration-zinc-600"
                  >
                    {med.den_comerciala}
                  </Link>
                  <form action={unsubscribeFromMedicine}>
                    <input type="hidden" name="cim" value={row.medicine_cim} />
                    <input type="hidden" name="slug" value="" />
                    <input type="hidden" name="locale" value={locale} />
                    <button
                      type="submit"
                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                    >
                      {t("unfollow")}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <form action={updateNotificationPreferences} className="mt-10 space-y-4">
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
