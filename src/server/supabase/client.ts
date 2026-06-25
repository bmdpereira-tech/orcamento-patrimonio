import "server-only";

import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

export function createSupabaseAdminClient() {
  if (!serverEnv.NEXT_PUBLIC_SUPABASE_URL || !serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase não está configurado no servidor.");
  }

  return createClient(serverEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
