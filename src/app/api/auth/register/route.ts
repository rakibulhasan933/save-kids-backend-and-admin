import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { createSessionToken, hashPassword, setSessionCookie } from "@/lib/auth";
import { apiError, handleRouteError } from "@/lib/http";
import { emailPasswordSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = emailPasswordSchema.parse(await request.json());
    const existing = await db.select({ id: admins.id }).from(admins).where(eq(admins.email, body.email)).limit(1);

    if (existing.length > 0) {
      return apiError(409, "Email is already registered");
    }

    const [admin] = await db
      .insert(admins)
      .values({ email: body.email, passwordHash: await hashPassword(body.password) })
      .returning({ id: admins.id, email: admins.email });

    const token = await createSessionToken({ adminId: admin.id, email: admin.email });
    const response = NextResponse.json({ admin }, { status: 201 });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
