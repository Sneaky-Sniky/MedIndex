import { load } from "cheerio";
import slugify from "slugify";
import type { AnmMedicineRow } from "@/lib/ingest/types";
import { ANM_BASE } from "@/lib/ingest/types";

export function parseMedicineListHtml(html: string): AnmMedicineRow[] {
  const $ = load(html);
  const rows: AnmMedicineRow[] = [];
  $("button[data-cim][data-dencom]").each((_, el) => {
    const b = $(el);
    rows.push({
      cim: b.attr("data-cim") ?? "",
      denComerciala: b.attr("data-dencom") ?? "",
      dci: b.attr("data-dci") ?? "",
      formaFarmaceutica: b.attr("data-formafarm") ?? "",
      concentratie: b.attr("data-conc") ?? "",
      codAtc: b.attr("data-codatc") ?? "",
      actTerapeutic: b.attr("data-actter") ?? "",
      prescriptie: b.attr("data-prescript") ?? "",
      ambalaj: b.attr("data-ambalaj") ?? "",
      volumAmbalaj: b.attr("data-volumamb") ?? "",
      valabilitateAmbalaj: b.attr("data-valabamb") ?? "",
      firmaTaraProducator: b.attr("data-firmtarp") ?? "",
      firmaTaraDetinator: b.attr("data-firmtard") ?? "",
      numarInregistrare: b.attr("data-nrdtamb") ?? "",
      linkRcp: b.attr("data-linkrcp") ?? "",
      linkProspect: b.attr("data-linkpro") ?? "",
      linkAmbalaj: b.attr("data-linkamb") ?? "",
      tipInregistrare: b.attr("data-tipinreg") ?? "",
    });
  });
  return rows.filter((r) => r.cim.length > 0);
}

export async function fetchAnmMedicinePage(page: number): Promise<string> {
  const url = `${ANM_BASE}/medicamente?page=${page}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "MedIndexBot/1.0 (+https://medindex) research catalog sync",
      Accept: "text/html",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`ANM fetch failed ${res.status} for page ${page}`);
  }
  return res.text();
}

export function rowToSlug(row: AnmMedicineRow): string {
  const base = slugify(`${row.denComerciala}-${row.cim}`, {
    lower: true,
    strict: true,
    trim: true,
  });
  return base.slice(0, 200) || row.cim.toLowerCase();
}
