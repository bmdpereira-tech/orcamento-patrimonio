import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/server/auth/session-core";

const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const hasValidSession =
      Boolean(token && serverEnv.APP_SESSION_SECRET) &&
      (await verifySessionToken(token as string, serverEnv.APP_SESSION_SECRET as string));

    if (hasValidSession) {
      return NextResponse.redirect(new URL("/orcamento", request.url));
    }

    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const hasValidSession =
    Boolean(token && serverEnv.APP_SESSION_SECRET) &&
    (await verifySessionToken(token as string, serverEnv.APP_SESSION_SECRET as string));

  if (!hasValidSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
