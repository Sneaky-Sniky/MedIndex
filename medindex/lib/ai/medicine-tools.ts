import type { SupabaseClient } from "@supabase/supabase-js";
import type OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  documentHasUsableContent,
  ensureMedicineLeafletsIndexed,
  fetchMedicineDocuments,
  type MedicineDocumentRow,
} from "@/lib/ai/documents";
import { isRagLogEnabled, ragLog } from "@/lib/ai/rag-log";

const MAX_SEARCH_RESULTS = 15;
const MAX_DOC_TEXT_CHARS = 14_000;

export const MEDICINE_RAG_TOOLS: OpenAI.Responses.Tool[] = [
  {
    type: "function",
    name: "search_medicines",
    description:
      "Search the ANMDM medicine catalog by commercial name, DCI (INN), CIM code, or ATC code. Use when the user names a product or you need to resolve which medicine they mean.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Name, DCI, CIM, or ATC fragment to search for.",
        },
        limit: {
          type: ["integer", "null"],
          description: "Max results (1–15). Defaults to 10.",
        },
      },
      required: ["query", "limit"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_medicine_info",
    description:
      "Fetch catalog metadata for one medicine by exact CIM code (denumire comercială, DCI, form, concentration, ATC, prescription type).",
    parameters: {
      type: "object",
      properties: {
        cim: { type: "string", description: "Exact medicine CIM code." },
      },
      required: ["cim"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_medicine_documents",
    description:
      "Fetch indexed official leaflet text (RCP, prospect, etc.) for a medicine by CIM. Call when you need dosage, contraindications, interactions, or other leaflet facts.",
    parameters: {
      type: "object",
      properties: {
        cim: { type: "string", description: "Exact medicine CIM code." },
        doc_types: {
          type: ["array", "null"],
          items: {
            type: "string",
            enum: ["rcp", "prospect", "ambalaj", "other"],
          },
          description:
            "Optional filter. Null = all indexed document types for this product.",
        },
      },
      required: ["cim", "doc_types"],
      additionalProperties: false,
    },
    strict: true,
  },
];

const TOOL_INSTRUCTIONS = `You have tools to explore the medicine database and official leaflets on demand.
- Use search_medicines to find products by name or DCI when the CIM is unknown.
- Use get_medicine_info for catalog facts; use get_medicine_documents for official leaflet content.
- Answer ONLY from tool results and any focused-medicine context in the user message. If leaflets lack the fact, say it is not in the indexed excerpts.
- Do not invent clinical details.`;

export function medicineRagInstructions(base: string): string {
  return `${base}\n\n${TOOL_INSTRUCTIONS}`;
}

type MedicineBrief = {
  cim: string;
  den_comerciala: string;
  dci: string | null;
  forma_farmaceutica: string | null;
  concentratie: string | null;
  cod_atc: string | null;
  prescriptie: string | null;
  slug: string;
};

async function fetchMedicineBrief(
  supabase: SupabaseClient,
  cim: string,
): Promise<MedicineBrief | null> {
  const { data, error } = await supabase
    .from("medicines")
    .select(
      "cim, den_comerciala, dci, forma_farmaceutica, concentratie, cod_atc, prescriptie, slug",
    )
    .eq("cim", cim)
    .maybeSingle();
  if (error) throw error;
  return (data as MedicineBrief | null) ?? null;
}

export async function formatFocusedMedicinesPrompt(
  supabase: SupabaseClient,
  cims: string[],
): Promise<string> {
  const unique = [...new Set(cims.filter(Boolean))];
  if (unique.length === 0) return "";

  const lines = [
    "Focused medicines (prioritize these; use tools to load leaflet text when needed):",
  ];
  for (const cim of unique) {
    const m = await fetchMedicineBrief(supabase, cim);
    if (m) {
      const parts = [
        m.den_comerciala,
        m.dci,
        m.forma_farmaceutica,
        m.concentratie,
        m.cod_atc,
      ].filter(Boolean);
      lines.push(`- CIM ${cim}: ${parts.join(" · ")}`);
    } else {
      lines.push(`- CIM ${cim} (not found in catalog)`);
    }
  }
  return lines.join("\n");
}

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n… [truncated]`;
}

function formatDocumentsPayload(
  cim: string,
  docs: MedicineDocumentRow[],
): Record<string, unknown> {
  if (docs.length === 0) {
    return { cim, documents: [], message: "No indexed documents for this CIM." };
  }

  const documents = docs.map((d) => {
    const text = d.extracted_text?.trim() ?? "";
    const hasPdf = Boolean(d.openai_file_id?.trim());
    return {
      doc_type: d.doc_type,
      has_extracted_text: Boolean(text),
      has_pdf_indexed: hasPdf,
      text: text ? truncateText(text, MAX_DOC_TEXT_CHARS) : null,
    };
  });

  return { cim, document_count: docs.length, documents };
}

async function searchMedicines(
  supabase: SupabaseClient,
  query: string,
  limit: number | null,
): Promise<Record<string, unknown>> {
  const q = query.trim();
  if (!q) return { medicines: [], message: "Empty search query." };

  const lim = Math.max(1, Math.min(limit ?? 10, MAX_SEARCH_RESULTS));
  const { data, error } = await supabase.rpc("search_medicines", {
    q,
    lim,
  });
  if (error) throw error;

  const medicines = ((data ?? []) as MedicineBrief[]).map((m) => ({
    cim: m.cim,
    den_comerciala: m.den_comerciala,
    dci: m.dci,
    forma_farmaceutica: m.forma_farmaceutica,
    concentratie: m.concentratie,
    cod_atc: m.cod_atc,
    slug: m.slug,
  }));

  return { query: q, count: medicines.length, medicines };
}

async function getMedicineInfo(
  supabase: SupabaseClient,
  cim: string,
): Promise<Record<string, unknown>> {
  const m = await fetchMedicineBrief(supabase, cim.trim());
  if (!m) return { cim, found: false };
  return { found: true, medicine: m };
}

async function getMedicineDocuments(
  supabase: SupabaseClient,
  cim: string,
  docTypes: string[] | null,
  logFlow?: string,
): Promise<Record<string, unknown>> {
  const code = cim.trim();
  let docs = await fetchMedicineDocuments(supabase, code);
  if (!docs.some(documentHasUsableContent)) {
    try {
      const admin = createAdminClient();
      ({ docs } = await ensureMedicineLeafletsIndexed(admin, code, logFlow));
    } catch {
      // on-demand sync requires service role
    }
  }
  if (docTypes?.length) {
    const allowed = new Set(docTypes);
    docs = docs.filter((d) => allowed.has(d.doc_type));
  }
  return formatDocumentsPayload(code, docs);
}

export function createMedicineToolRunner(
  supabase: SupabaseClient,
  logFlow?: string,
) {
  return async function runMedicineTool(
    name: string,
    argsJson: string,
  ): Promise<string> {
    const flow = logFlow;
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(argsJson) as Record<string, unknown>;
    } catch {
      const out = JSON.stringify({ error: "Invalid JSON arguments" });
      if (flow && isRagLogEnabled()) {
        ragLog(flow, `db · ${name} · parse_error`, { argsJson, output: out });
      }
      return out;
    }

    if (flow && isRagLogEnabled()) {
      ragLog(flow, `db · ${name} · invoke`, { arguments: args });
    }

    const t0 = performance.now();
    try {
      let payload: Record<string, unknown>;
      switch (name) {
        case "search_medicines":
          payload = await searchMedicines(
            supabase,
            String(args.query ?? ""),
            typeof args.limit === "number" ? args.limit : null,
          );
          break;
        case "get_medicine_info":
          payload = await getMedicineInfo(supabase, String(args.cim ?? ""));
          break;
        case "get_medicine_documents":
          payload = await getMedicineDocuments(
            supabase,
            String(args.cim ?? ""),
            Array.isArray(args.doc_types)
              ? (args.doc_types as string[])
              : null,
            logFlow,
          );
          break;
        default:
          payload = { error: `Unknown tool: ${name}` };
      }
      const out = JSON.stringify(payload);
      if (flow && isRagLogEnabled()) {
        ragLog(flow, `db · ${name} · result`, {
          ms: Math.round(performance.now() - t0),
          output: out,
        });
      }
      return out;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Tool failed";
      const out = JSON.stringify({ error: message });
      if (flow && isRagLogEnabled()) {
        ragLog(flow, `db · ${name} · error`, {
          ms: Math.round(performance.now() - t0),
          error: message,
        });
      }
      return out;
    }
  };
}
