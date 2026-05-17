import type { SupabaseClient } from "@supabase/supabase-js";

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
