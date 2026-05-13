import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { subscribeToMedicine, unsubscribeFromMedicine } from "@/actions/community";
import { createClient } from "@/lib/supabase/server";

export async function MedicineSubscriptionSection({
  locale,
  medicineCim,
  slug,
}: {
  locale: string;
  medicineCim: string;
  slug: string;
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "medicine" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let subscribed = false;
  if (user) {
    const { data } = await supabase
      .from("medicine_subscriptions")
      .select("medicine_cim")
      .eq("user_id", user.id)
      .eq("medicine_cim", medicineCim)
      .maybeSingle();
    subscribed = !!data;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-3 text-sm text-zinc-800">
      {!user ? (
        <p>
          <Link href="/login" className="font-medium text-blue-700 underline">
            {t("subscribeLogin")}
          </Link>
          <span className="text-zinc-600"> — {t("subscribeTeaser")}</span>
        </p>
      ) : subscribed ? (
        <form action={unsubscribeFromMedicine} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="cim" value={medicineCim} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="locale" value={locale} />
          <span className="text-zinc-700">{t("subscribedLabel")}</span>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-medium text-zinc-900 hover:bg-zinc-50"
          >
            {t("unsubscribe")}
          </button>
        </form>
      ) : (
        <form action={subscribeToMedicine} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="cim" value={medicineCim} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="locale" value={locale} />
          <span className="text-zinc-600">{t("subscribeTeaserAuthed")}</span>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-medium text-zinc-900 hover:bg-zinc-50"
          >
            {t("subscribe")}
          </button>
        </form>
      )}
    </div>
  );
}
