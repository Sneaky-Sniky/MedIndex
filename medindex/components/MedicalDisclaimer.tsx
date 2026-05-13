import { useTranslations } from "next-intl";

type Variant = "short" | "ai";

export function MedicalDisclaimer({ variant = "short" }: { variant?: Variant }) {
  const t = useTranslations("disclaimer");
  const text = variant === "ai" ? t("ai") : t("short");
  return (
    <aside
      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
      role="note"
    >
      {text}
    </aside>
  );
}
