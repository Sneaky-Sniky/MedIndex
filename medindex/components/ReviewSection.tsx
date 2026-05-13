import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ReviewForm } from "@/components/ReviewForm";

export async function ReviewSection({
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
  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, rating, body, created_at, user_id")
    .eq("medicine_cim", medicineCim)
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <section>
      <h2 className="text-lg font-medium text-zinc-950">{t("reviews")}</h2>
      <ul className="mt-2 space-y-2">
        {(reviews ?? []).map((r) => (
          <li
            key={r.id}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm"
          >
            <div className="font-medium">
              {"★".repeat(r.rating)}
              {"☆".repeat(5 - r.rating)}
            </div>
            <p className="mt-1 text-zinc-700">{r.body}</p>
          </li>
        ))}
      </ul>
      <ReviewForm cim={medicineCim} slug={slug} locale={locale} />
    </section>
  );
}
