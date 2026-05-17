import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnmMedicineRow } from "@/lib/ingest/types";
import { leafletsBucket, syncLeafletsForMedicine } from "@/lib/ingest/process-leaflets";
import { isRagLogEnabled, ragLog } from "@/lib/ai/rag-log";

export type MedicineDocumentRow = {
  id: string;
  doc_type: string;
  extracted_text: string | null;
  openai_file_id: string | null;
};

export async function fetchMedicineDocuments(
  supabase: SupabaseClient,
  medicineCim: string,
): Promise<MedicineDocumentRow[]> {
  const { data, error } = await supabase
    .from("medicine_documents")
    .select("id, doc_type, extracted_text, openai_file_id")
    .eq("medicine_cim", medicineCim)
    .order("doc_type", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MedicineDocumentRow[];
}

export function documentFileIds(docs: MedicineDocumentRow[]): string[] {
  return docs
    .map((d) => d.openai_file_id?.trim())
    .filter((id): id is string => Boolean(id));
}

export function documentTextContext(docs: MedicineDocumentRow[]): string {
  return docs
    .filter((d) => d.extracted_text?.trim())
    .map((d) => `[${d.doc_type}]\n${d.extracted_text!.trim()}`)
    .join("\n\n---\n\n");
}

export function documentHasUsableContent(doc: MedicineDocumentRow): boolean {
  return Boolean(doc.extracted_text?.trim() || doc.openai_file_id?.trim());
}

type MedicineLinksRow = {
  cim: string;
  den_comerciala: string;
  link_rcp: string | null;
  link_prospect: string | null;
  link_ambalaj: string | null;
};

function medicineLinksToAnmRow(m: MedicineLinksRow): AnmMedicineRow {
  return {
    cim: m.cim,
    denComerciala: m.den_comerciala,
    dci: "",
    formaFarmaceutica: "",
    concentratie: "",
    codAtc: "",
    actTerapeutic: "",
    prescriptie: "",
    ambalaj: "",
    volumAmbalaj: "",
    valabilitateAmbalaj: "",
    firmaTaraProducator: "",
    firmaTaraDetinator: "",
    numarInregistrare: "",
    linkRcp: m.link_rcp ?? "",
    linkProspect: m.link_prospect ?? "",
    linkAmbalaj: m.link_ambalaj ?? "",
    tipInregistrare: "",
  };
}

/** Index ANMDM PDFs into medicine_documents when missing (e.g. user opened summary before batch ingest). */
export async function ensureMedicineLeafletsIndexed(
  admin: SupabaseClient,
  medicineCim: string,
  logFlow?: string,
): Promise<{ docs: MedicineDocumentRow[]; synced: boolean }> {
  let docs = await fetchMedicineDocuments(admin, medicineCim);
  if (docs.some(documentHasUsableContent)) {
    return { docs, synced: false };
  }

  const { data: med, error } = await admin
    .from("medicines")
    .select("cim, den_comerciala, link_rcp, link_prospect, link_ambalaj")
    .eq("cim", medicineCim)
    .maybeSingle();
  if (error) throw error;
  if (!med?.link_rcp && !med?.link_prospect && !med?.link_ambalaj) {
    return { docs, synced: false };
  }

  if (logFlow && isRagLogEnabled()) {
    ragLog(logFlow, "leaflets · on-demand sync · start", {
      medicineCim,
      link_rcp: med.link_rcp,
      link_prospect: med.link_prospect,
      link_ambalaj: med.link_ambalaj,
    });
  }

  const result = await syncLeafletsForMedicine(
    admin,
    medicineLinksToAnmRow(med as MedicineLinksRow),
    { maxDocs: 3, bucket: leafletsBucket() },
  );

  docs = await fetchMedicineDocuments(admin, medicineCim);

  if (logFlow && isRagLogEnabled()) {
    ragLog(logFlow, "leaflets · on-demand sync · done", {
      medicineCim,
      syncedDocs: result.docs,
      fileIds: documentFileIds(docs),
      excerptChars: documentTextContext(docs).length,
    });
  }

  return { docs, synced: result.docs > 0 };
}
