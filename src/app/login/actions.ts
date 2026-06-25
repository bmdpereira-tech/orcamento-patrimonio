"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { createSessionCookie } from "@/server/auth/session";

const loginSchema = z.object({
  password: z.string().min(1),
});

export type LoginState = {
  error?: string;
};

export async function loginAction(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    password: formData.get("password"),
  });

  if (!parsed.success || !serverEnv.APP_PASSWORD_HASH || !serverEnv.APP_SESSION_SECRET) {
    return { error: "Não foi possível iniciar sessão." };
  }

  if (serverEnv.APP_PASSWORD_HASH.length < 20 || serverEnv.APP_SESSION_SECRET.length < 32) {
    return { error: "Não foi possível iniciar sessão." };
  }

  const passwordMatches = await bcrypt.compare(parsed.data.password, serverEnv.APP_PASSWORD_HASH);

  if (!passwordMatches) {
    return { error: "Não foi possível iniciar sessão." };
  }

  await createSessionCookie();
  redirect("/orcamento");
}
