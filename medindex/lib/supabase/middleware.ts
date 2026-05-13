import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { tryPublicSupabaseEnv } from "@/lib/env";

export async function updateSession(
  request: NextRequest,
  response: NextResponse,
) {
  const pub = tryPublicSupabaseEnv();
  if (!pub) {
    return response;
  }

  const supabase = createServerClient(pub.url, pub.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}
