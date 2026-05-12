import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSyncForm } from "@/components/AdminSyncForm";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "admin" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (prof?.role !== "admin") {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <p>{t("denied")}</p>
      </main>
    );
  }

  const { data: reports } = await supabase
    .from("error_reports")
    .select("id, message, status, created_at, medicine_cim")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <section className="mt-8">
        <h2 className="text-lg font-medium">{t("sync")}</h2>
        <div className="mt-2">
          <AdminSyncForm />
        </div>
      </section>
      <section className="mt-12">
        <h2 className="text-lg font-medium">{t("reports")}</h2>
        <ul className="mt-2 divide-y rounded-lg border border-zinc-200 bg-white text-sm">
          {(reports ?? []).map((r) => (
            <li key={r.id} className="px-3 py-2">
              <div className="font-medium">{r.status}</div>
              <div className="text-zinc-600">{r.message}</div>
              <div className="text-xs text-zinc-400">{r.medicine_cim}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
