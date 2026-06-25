import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  APP_PASSWORD_HASH: z.string().optional(),
  APP_SESSION_SECRET: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
});

export const serverEnv = serverEnvSchema.parse(process.env);
