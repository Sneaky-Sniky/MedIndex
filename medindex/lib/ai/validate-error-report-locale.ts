export type ValidateReportLocale = "ro" | "hu";

const INSTRUCTIONS: Record<ValidateReportLocale, string> = {
  ro: `Ajuți administratorii să triajeze raportările de erori despre medicamente din catalog.
Folosește instrumentele pentru metadata din catalog și prospectele oficiale când există CIM.
Fii concis. Este o verificare internă a calității datelor, nu sfat medical pentru pacienți.

Răspunde integral în limba română, inclusiv titlurile secțiunilor.

Structurează răspunsul în markdown:

## Verdict
Exact una dintre: **Probabil validă** | **Probabil invalidă** | **Necunoscut** | **Nu se aplică**

## Rezumat
2–4 propoziții cu motivarea ta.

## Dovezi
Listă cu puncte: ce ai comparat (câmpuri, pasaje din prospect/RCP).`,
  hu: `Segíts az adminisztrátoroknak a gyógyszerkatalógus hibabejelentéseinek triázsában.
Használd az eszközöket a katalógus metaadatokhoz és a hivatalos betegtájékoztatókhoz, ha van CIM.
Legyél tömör. Ez belső adatminőség-ellenőrzés, nem betegtanács.

Válaszolj teljes egészében magyarul, a szakaszok címeivel együtt.

A válasz szerkezete markdownban:

## Ítélet
Pontosan egy: **Valószínűleg érvényes** | **Valószínűleg érvénytelen** | **Bizonytalan** | **Nem alkalmazható**

## Összefoglaló
2–4 mondat az érveléssel.

## Bizonyíték
Felsorolás: mit hasonlítottál össze (mezők, betegtájékoztató/RCP részletek).`,
};

const FALLBACK: Record<ValidateReportLocale, string> = {
  ro: "Nu am putut genera o evaluare.",
  hu: "Nem sikerült értékelést generálni.",
};

export function validateReportInstructions(locale: ValidateReportLocale): string {
  return INSTRUCTIONS[locale];
}

export function validateReportFallback(locale: ValidateReportLocale): string {
  return FALLBACK[locale];
}

export function buildValidateReportInput(opts: {
  locale: ValidateReportLocale;
  message: string;
  medicineCim: string | null;
  focusBlock?: string;
}): string {
  const parts: string[] = [];

  if (opts.locale === "hu") {
    parts.push("Felhasználói bejelentés:", opts.message);
    if (opts.focusBlock) parts.push("", opts.focusBlock);
    if (opts.medicineCim) {
      parts.push(
        "",
        "Ha szükséges, csatold a betegtájékoztatót (attach_medicine_leaflets) és keress a hivatalos PDF-ekben (file_search).",
      );
    } else {
      parts.push(
        "",
        "Nincs CIM hozzárendelve. Értékeld, hogy a bejelentés kezelhető-e konkrét termék nélkül.",
      );
    }
    return parts.join("\n");
  }

  parts.push("Raportare utilizator:", opts.message);
  if (opts.focusBlock) parts.push("", opts.focusBlock);
  if (opts.medicineCim) {
    parts.push(
      "",
      "Dacă e nevoie, atașează prospectul (attach_medicine_leaflets) și caută în PDF-urile oficiale (file_search).",
    );
  } else {
    parts.push(
      "",
      "Nu există CIM asociat. Evaluează dacă raportarea poate fi acționată fără un produs specific.",
    );
  }
  return parts.join("\n");
}
