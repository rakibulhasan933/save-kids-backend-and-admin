import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { apiError, handleRouteError } from "@/lib/http";
import { emailPasswordSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = emailPasswordSchema.parse(await request.json());
    const [admin] = await db.select().from(admins).where(eq(admins.email, body.email)).limit(1);

    if (!admin || !(await verifyPassword(body.password, admin.passwordHash))) {
      return apiError(401, "Invalid email or password");
    }

    const token = await createSessionToken({ adminId: admin.id, email: admin.email });
    const response = NextResponse.json({ admin: { id: admin.id, email: admin.email } });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
