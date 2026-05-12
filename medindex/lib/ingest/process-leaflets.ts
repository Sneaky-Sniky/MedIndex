import "server-only";
import { createHash } from "node:crypto";
import OpenAI from "openai";
import { extractText, getDocumentProxy } from "unpdf";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnmMedicineRow } from "@/lib/ingest/types";

const CHUNK = 900;
const CHUNK_OVERLAP = 120;

function chunkText(text: string): string[] {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return [];
  const parts: string[] = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(t.length, i + CHUNK);
    parts.push(t.slice(i, end));
    if (end >= t.length) break;
    i = end - CHUNK_OVERLAP;
    if (i < 0) i = 0;
  }
  return parts;
}

async function sha256(buf: ArrayBuffer): Promise<string> {
  return createHash("sha256").update(Buffer.from(buf)).digest("hex");
}

async function downloadPdf(url: string): Promise<ArrayBuffer | null> {
  if (!url || !url.startsWith("http")) return null;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MedIndexBot/1.0" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("pdf") && !url.toLowerCase().endsWith(".pdf")) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 5000) return null;
      return buf;
    }
    return res.arrayBuffer();
  } catch {
    return null;
  }
}

async function pdfToText(buffer: ArrayBuffer): Promise<string> {
  const doc = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(doc, { mergePages: true });
  if (typeof text === "string") return text;
  return "";
}

async function embedBatch(
  openai: OpenAI | null,
  inputs: string[],
): Promise<number[][]> {
  if (!openai || inputs.length === 0) return inputs.map(() => []);
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    dimensions: 1536,
    input: inputs,
  });
  return res.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding as number[]);
}

export async function syncLeafletsForMedicine(
  admin: SupabaseClient,
  row: AnmMedicineRow,
  opts: { maxDocs: number; bucket: string },
): Promise<{ docs: number; chunks: number }> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

  const candidates: { type: "rcp" | "prospect" | "ambalaj"; url: string }[] =
    [];
  if (row.linkRcp) candidates.push({ type: "rcp", url: row.linkRcp });
  if (row.linkProspect) candidates.push({ type: "prospect", url: row.linkProspect });
  if (row.linkAmbalaj) candidates.push({ type: "ambalaj", url: row.linkAmbalaj });

  let docs = 0;
  let chunks = 0;
  let used = 0;

  for (const c of candidates) {
    if (used >= opts.maxDocs) break;
    const buf = await downloadPdf(c.url);
    if (!buf) continue;
    used += 1;
    const checksum = await sha256(buf);
    const storagePath = `${row.cim}/${c.type}.pdf`;

    const { error: upErr } = await admin.storage
      .from(opts.bucket)
      .upload(storagePath, buf, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr) {
      console.warn("storage upload", row.cim, c.type, upErr.message);
    }

    let extracted = "";
    try {
      extracted = await pdfToText(buf);
    } catch (e) {
      console.warn("pdf text", row.cim, e);
    }

    const { data: docRow, error: docErr } = await admin
      .from("medicine_documents")
      .upsert(
        {
          medicine_cim: row.cim,
          doc_type: c.type,
          source_url: c.url,
          storage_path: upErr ? null : storagePath,
          extracted_text: extracted,
          checksum,
        },
        { onConflict: "medicine_cim,doc_type" },
      )
      .select("id")
      .single();

    if (docErr || !docRow) {
      console.warn("medicine_documents upsert", docErr?.message);
      continue;
    }
    docs += 1;

    await admin.from("document_chunks").delete().eq("document_id", docRow.id);

    const parts = chunkText(extracted);
    if (parts.length === 0) continue;

    const embeddings = await embedBatch(openai, parts);
    for (let chunk_index = 0; chunk_index < parts.length; chunk_index += 1) {
      const content = parts[chunk_index]!;
      const emb = embeddings[chunk_index];
      const vec =
        emb && emb.length === 1536 ? `[${emb.join(",")}]` : null;
      const { error: chErr } = await admin.rpc("insert_document_chunk", {
        p_medicine_cim: row.cim,
        p_document_id: docRow.id,
        p_chunk_index: chunk_index,
        p_content: content,
        p_embedding: vec,
        p_metadata: { doc_type: c.type },
      });
      if (chErr) {
        console.warn("insert_document_chunk", chErr.message);
      } else {
        chunks += 1;
      }
    }
  }

  return { docs, chunks };
}

export function leafletsBucket(): string {
  return process.env.LEAFLETS_BUCKET ?? "leaflets";
}
