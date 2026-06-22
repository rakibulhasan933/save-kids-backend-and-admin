import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { liveScreenSessions } from "@/db/schema";
import { requireAdminApi } from "@/lib/auth";
import { getOwnedLiveScreenSession } from "@/lib/data-access";
import { apiError, handleRouteError } from "@/lib/http";
import { failLiveScreenSchema } from "@/lib/validators";

type Context = { params: Promise<{ sessionId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { sessionId } = await params;
    const { admin, response } = await requireAdminApi();
    if (response) return response;

    const existing = await getOwnedLiveScreenSession(sessionId, admin.id);
    if (!existing) return apiError(404, "Live screen session not found");

    const body = failLiveScreenSchema.parse(await request.json());
    const [session] = await db
      .update(liveScreenSessions)
      .set({ status: "failed", endedAt: new Date(), reason: body.reason })
      .where(eq(liveScreenSessions.id, sessionId))
      .returning();

    return NextResponse.json({ session });
  } catch (error) {
    return handleRouteError(error);
  }
}
