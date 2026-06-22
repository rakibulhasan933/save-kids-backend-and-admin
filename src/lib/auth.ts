import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/db";
import { admins, type Admin } from "@/db/schema";
import { apiError } from "@/lib/http";

const SESSION_COOKIE = "admin_session";
const encoder = new TextEncoder();

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
  }
  return encoder.encode(secret);
}

export type SessionPayload = {
  adminId: string;
  email: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(jwtSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    if (typeof payload.adminId !== "string" || typeof payload.email !== "string") {
      return null;
    }
    return { adminId: payload.adminId, email: payload.email };
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function getCurrentAdminFromCookie(): Promise<Pick<Admin, "id" | "email"> | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const [admin] = await db
    .select({ id: admins.id, email: admins.email })
    .from(admins)
    .where(eq(admins.id, payload.adminId))
    .limit(1);

  return admin ?? null;
}

export async function requireAdminPage() {
  const admin = await getCurrentAdminFromCookie();
  if (!admin) redirect("/login");
  return admin;
}

export async function requireAdminApi() {
  const admin = await getCurrentAdminFromCookie();
  if (!admin) {
    return { admin: null, response: apiError(401, "Unauthorized") };
  }
  return { admin, response: null };
}

export function getSessionTokenFromRequest(request: NextRequest) {
  return request.cookies.get(SESSION_COOKIE)?.value;
}

export async function isAuthenticatedRequest(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);
  if (!token) return false;
  return Boolean(await verifySessionToken(token));
}
