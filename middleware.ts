import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = ["/dashboard", "/children"];
const authRoutes = ["/login", "/register"];
const encoder = new TextEncoder();

async function isAuthenticatedRequest(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  const secret = process.env.JWT_SECRET;

  if (!token || !secret || secret.length < 32) return false;

  try {
    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(token, encoder.encode(secret));
    return typeof payload.adminId === "string";
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));
  const authenticated = await isAuthenticatedRequest(request);

  if (isProtected && !authenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthRoute && authenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/children/:path*", "/login", "/register"]
};
