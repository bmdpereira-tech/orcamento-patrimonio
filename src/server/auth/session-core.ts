import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE_NAME = "budget_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();

function getSessionSecretKey(secret: string) {
  return encoder.encode(secret);
}

export async function signSessionToken(secret: string) {
  return new SignJWT({ sub: "single-user" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSessionSecretKey(secret));
}

export async function verifySessionToken(token: string, secret: string) {
  try {
    const { payload } = await jwtVerify(token, getSessionSecretKey(secret));
    return payload.sub === "single-user";
  } catch {
    return false;
  }
}
