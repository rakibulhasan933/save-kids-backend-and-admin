import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { liveScreenSessions } from "@/db/schema";
import { requireAdminApi } from "@/lib/auth";
import { getOwnedLiveScreenSession } from "@/lib/data-access";
import { apiError, handleRouteError } from "@/lib/http";

type Context = { params: Promise<{ sessionId: string }> };

export async function PATCH(_request: Request, { params }: Context) {
  try {
    const { sessionId } = await params;
    const { admin, response } = await requireAdminApi();
    if (response) return response;

    const existing = await getOwnedLiveScreenSession(sessionId, admin.id);
    if (!existing) return apiError(404, "Live screen session not found");

    const [session] = await db
      .update(liveScreenSessions)
      .set({ status: "active", startedAt: new Date(), reason: null })
      .where(eq(liveScreenSessions.id, sessionId))
      .returning();

    return NextResponse.json({ session });
  } catch (error) {
    return handleRouteError(error);
  }
}
