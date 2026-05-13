import { z } from "zod";

/** Ingest / cron tuning (no Supabase publishable keys required). */
export function anmIngestEnv() {
  const parsed = z
    .object({
      ANM_SYNC_MAX_PAGES: z.coerce.number().min(1).max(2000).default(3),
      LEAFLETS_BUCKET: z.string().default("leaflets"),
    })
    .safeParse({
      ANM_SYNC_MAX_PAGES: process.env.ANM_SYNC_MAX_PAGES,
      LEAFLETS_BUCKET: process.env.LEAFLETS_BUCKET,
    });
  if (!parsed.success) {
    throw new Error("Invalid ANM ingest env (ANM_SYNC_MAX_PAGES / LEAFLETS_BUCKET)");
  }
  return parsed.data;
}

/**
 * URL + anon key for browser and cookie-based server clients.
 * Never use placeholder JWTs — they produce Supabase "Invalid API key".
 */
export function publicSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Add it to .env.local (Supabase → Project Settings → API → Project URL).",
    );
  }
  if (!anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Add the anon public key from the same API page.",
    );
  }
  try {
    new URL(url);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
  }
  if (!anonKey.startsWith("eyJ")) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY must be the anon JWT (long string starting with eyJ). Check you did not swap it with the service_role key or truncate the copy.",
    );
  }
  return { url, anonKey };
}

/** For middleware: skip Supabase when env is incomplete (avoids invalid apikey on every request). */
export function tryPublicSupabaseEnv(): { url: string; anonKey: string } | null {
  try {
    return publicSupabaseEnv();
  } catch {
    return null;
  }
}
