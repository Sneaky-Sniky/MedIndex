import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { MedicineAiPanel } from "@/components/MedicineAiPanel";
import { ReviewSection } from "@/components/ReviewSection";
import { ReportErrorForm } from "@/components/ReportErrorForm";
import { BasketButton } from "@/components/BasketButton";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function MedicinePage({ params }: Props) {
  const { locale, slug } = await params;
  if (locale !== "ro" && locale !== "hu") notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "medicine" });
  const supabase = await createClient();

  const { data: med, error } = await supabase
    .from("medicines")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !med) notFound();

  const { data: subs } = await supabase
    .from("medicines")
    .select("cim, den_comerciala, slug")
    .eq("cod_atc", med.cod_atc as string)
    .neq("cim", med.cim)
    .limit(15);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <article className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-950">{med.den_comerciala}</h1>
          <dl className="mt-4 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-900">{t("dci")}</dt>
              <dd className="text-zinc-800">{med.dci ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">{t("atc")}</dt>
              <dd className="text-zinc-800">{med.cod_atc ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">{t("form")}</dt>
              <dd className="text-zinc-800">{med.forma_farmaceutica ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">{t("holder")}</dt>
              <dd className="text-zinc-800">{med.firma_tara_detinator ?? "—"}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {med.link_rcp ? (
              <a
                className="text-blue-700 underline"
                href={med.link_rcp}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("rcp")}
              </a>
            ) : null}
            {med.link_prospect ? (
              <a
                className="text-blue-700 underline"
                href={med.link_prospect}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("prospect")}
              </a>
            ) : null}
          </div>
        </header>

        <MedicalDisclaimer variant="short" />

        <BasketButton
          cim={med.cim}
          labelAdd={t("basketAdd")}
          labelRemove={t("basketRemove")}
        />

        <MedicineAiPanel locale={locale} medicineCim={med.cim} />

        <section>
          <h2 className="text-lg font-medium text-zinc-950">{t("substitutes")}</h2>
          {!subs?.length ? (
            <p className="mt-2 text-sm text-zinc-600">{t("noSubstitutes")}</p>
          ) : (
            <ul className="mt-2 divide-y rounded-lg border border-zinc-200 bg-white">
              {subs.map((s) => (
                <li key={s.cim}>
                  <Link
                    href={`/medicine/${s.slug}`}
                    className="block px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
                  >
                    {s.den_comerciala}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ReviewSection locale={locale} medicineCim={med.cim} slug={slug} />
        <ReportErrorForm locale={locale} medicineCim={med.cim} slug={slug} />
      </article>
    </main>
  );
}
