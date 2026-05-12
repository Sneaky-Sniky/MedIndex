import { z } from "zod";

const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.placeholder.placeholder";

const server = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  ANM_SYNC_MAX_PAGES: z.coerce.number().min(1).max(2000).default(3),
  LEAFLETS_BUCKET: z.string().default("leaflets"),
});

const client = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url()
    .optional()
    .transform((v) => v || PLACEHOLDER_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1)
    .optional()
    .transform((v) => v || PLACEHOLDER_ANON),
});

const merged = client.merge(server);

export type Env = z.infer<typeof merged>;

function readEnv(): Env {
  const parsed = merged.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANM_SYNC_MAX_PAGES: process.env.ANM_SYNC_MAX_PAGES,
    LEAFLETS_BUCKET: process.env.LEAFLETS_BUCKET,
  });
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}

let cached: Env | null = null;

export function env(): Env {
  if (!cached) cached = readEnv();
  return cached;
}
