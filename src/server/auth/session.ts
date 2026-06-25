import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverEnv } from "@/lib/env";
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  signSessionToken,
  verifySessionToken,
} from "./session-core";

export type AppSession = {
  userId: "single-user";
};

export async function getSession(): Promise<AppSession | null> {
  const secret = serverEnv.APP_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    return null;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const valid = await verifySessionToken(token, secret);
  return valid ? { userId: "single-user" } : null;
}

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function createSessionCookie() {
  if (!serverEnv.APP_SESSION_SECRET || serverEnv.APP_SESSION_SECRET.length < 32) {
    throw new Error("APP_SESSION_SECRET não está configurado.");
  }

  const token = await signSessionToken(serverEnv.APP_SESSION_SECRET);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: serverEnv.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: serverEnv.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
