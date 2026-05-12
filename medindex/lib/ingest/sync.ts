import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchAnmMedicinePage,
  parseMedicineListHtml,
  rowToSlug,
} from "@/lib/ingest/anm";
import type { AnmMedicineRow } from "@/lib/ingest/types";
import { leafletsBucket, syncLeafletsForMedicine } from "@/lib/ingest/process-leaflets";
import { env } from "@/lib/env";

const INGEST_KEY = "anm_sync";

type IngestPayload = {
  next_page: number;
};

function rowToMedicineRecord(row: AnmMedicineRow) {
  return {
    cim: row.cim,
    den_comerciala: row.denComerciala,
    dci: row.dci || null,
    forma_farmaceutica: row.formaFarmaceutica || null,
    concentratie: row.concentratie || null,
    cod_atc: row.codAtc || null,
    act_terapeutic: row.actTerapeutic || null,
    prescriptie: row.prescriptie || null,
    ambalaj: row.ambalaj || null,
    volum_ambalaj: row.volumAmbalaj || null,
    valabilitate_ambalaj: row.valabilitateAmbalaj || null,
    firma_tara_producator: row.firmaTaraProducator || null,
    firma_tara_detinator: row.firmaTaraDetinator || null,
    numar_inregistrare: row.numarInregistrare || null,
    link_rcp: row.linkRcp || null,
    link_prospect: row.linkProspect || null,
    link_ambalaj: row.linkAmbalaj || null,
    tip_inregistrare: row.tipInregistrare || null,
    anm_payload: row as unknown as Record<string, unknown>,
    slug: rowToSlug(row),
  };
}

export async function runAnmIngest(admin: SupabaseClient): Promise<{
  pages: number;
  upserted: number;
  leaflets: { docs: number; chunks: number };
}> {
  const e = env();
  const maxPages = e.ANM_SYNC_MAX_PAGES;
  const maxLeafletsPerMedicine = 2;
  const maxMedicinesLeafletsPerPage = Number(
    process.env.ANM_LEAFLET_MEDICINES_PER_PAGE ?? "2",
  );

  const { data: stateRow } = await admin
    .from("ingest_state")
    .select("payload")
    .eq("job_key", INGEST_KEY)
    .maybeSingle();

  const payload = (stateRow?.payload ?? {}) as IngestPayload;
  let page = typeof payload.next_page === "number" ? payload.next_page : 1;

  let upserted = 0;
  let leafletDocs = 0;
  let leafletChunks = 0;
  const bucket = leafletsBucket();

  for (let n = 0; n < maxPages; n += 1) {
    const html = await fetchAnmMedicinePage(page);
    const rows = parseMedicineListHtml(html);
    if (rows.length === 0) {
      page = 1;
      break;
    }

    const records = rows.map(rowToMedicineRecord);
    const { error } = await admin.from("medicines").upsert(records, {
      onConflict: "cim",
    });
    if (error) {
      throw new Error(`medicines upsert page ${page}: ${error.message}`);
    }
    upserted += records.length;

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]!;
      if (i >= maxMedicinesLeafletsPerPage) break;
      const r = await syncLeafletsForMedicine(admin, row, {
        maxDocs: maxLeafletsPerMedicine,
        bucket,
      });
      leafletDocs += r.docs;
      leafletChunks += r.chunks;
    }

    page += 1;
    await admin.from("ingest_state").upsert(
      {
        job_key: INGEST_KEY,
        payload: { next_page: page } satisfies IngestPayload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "job_key" },
    );
  }

  return { pages: maxPages, upserted, leaflets: { docs: leafletDocs, chunks: leafletChunks } };
}
