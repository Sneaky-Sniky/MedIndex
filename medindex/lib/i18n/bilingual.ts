export type AppLocale = "ro" | "hu";

export type BilingualContent = Record<AppLocale, string | null>;

export const otherLocale = (locale: AppLocale): AppLocale =>
  locale === "ro" ? "hu" : "ro";

/** Prefer the requested locale; fall back to the other if only that exists. */
export function pickBilingualContent(
  locale: AppLocale,
  content: BilingualContent,
): string | null {
  const primary = content[locale]?.trim();
  if (primary) return primary;
  return content[otherLocale(locale)]?.trim() || null;
}
