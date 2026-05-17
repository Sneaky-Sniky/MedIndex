import "server-only";
import { createHash } from "node:crypto";
import type OpenAI from "openai";
import {
  completeChat,
  createOpenAI,
  uploadPdfToOpenAI,
} from "@/lib/ai/openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnmMedicineRow } from "@/lib/ingest/types";

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

async function analyzePdf(
  openai: OpenAI,
  fileId: string,
  docType: string,
): Promise<string> {
  return completeChat(openai, {
    instructions:
      "You extract text from official medicine PDFs (Romanian ANMDM). Return the readable document text only, preserving sections where possible. No commentary.",
    input: `Extract all readable text from this ${docType} PDF.`,
    fileIds: [fileId],
    maxOutputTokens: 16000,
  });
}

export async function syncLeafletsForMedicine(
  admin: SupabaseClient,
  row: AnmMedicineRow,
  opts: { maxDocs: number; bucket: string },
): Promise<{ docs: number; chunks: number }> {
  const openai = createOpenAI();
  if (!openai) {
    console.warn("OPENAI_API_KEY missing; skipping leaflet analysis for", row.cim);
    return { docs: 0, chunks: 0 };
  }

  const candidates: { type: "rcp" | "prospect" | "ambalaj"; url: string }[] =
    [];
  if (row.linkRcp) candidates.push({ type: "rcp", url: row.linkRcp });
  if (row.linkProspect) candidates.push({ type: "prospect", url: row.linkProspect });
  if (row.linkAmbalaj) candidates.push({ type: "ambalaj", url: row.linkAmbalaj });

  let docs = 0;
  let used = 0;

  for (const c of candidates) {
    if (used >= opts.maxDocs) break;
    const buf = await downloadPdf(c.url);
    if (!buf) continue;
    used += 1;
    const checksum = await sha256(buf);
    const storagePath = `${row.cim}/${c.type}.pdf`;
    const filename = `${row.cim}-${c.type}.pdf`;

    const { error: upErr } = await admin.storage
      .from(opts.bucket)
      .upload(storagePath, buf, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr) {
      console.warn("storage upload", row.cim, c.type, upErr.message);
    }

    let openaiFileId: string | null = null;
    let extracted = "";
    try {
      openaiFileId = await uploadPdfToOpenAI(openai, buf, filename);
      extracted = await analyzePdf(openai, openaiFileId, c.type);
    } catch (e) {
      console.warn("openai pdf analysis", row.cim, c.type, e);
    }

    const { error: docErr } = await admin.from("medicine_documents").upsert(
      {
        medicine_cim: row.cim,
        doc_type: c.type,
        source_url: c.url,
        storage_path: upErr ? null : storagePath,
        openai_file_id: openaiFileId,
        extracted_text: extracted || null,
        checksum,
      },
      { onConflict: "medicine_cim,doc_type" },
    );

    if (docErr) {
      console.warn("medicine_documents upsert", docErr.message);
      continue;
    }
    docs += 1;
  }

  return { docs, chunks: 0 };
}

export function leafletsBucket(): string {
  return process.env.LEAFLETS_BUCKET ?? "leaflets";
}
