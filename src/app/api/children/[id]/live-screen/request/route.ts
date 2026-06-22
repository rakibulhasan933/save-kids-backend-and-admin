import { NextResponse } from "next/server";
import { db } from "@/db";
import { liveScreenSessions } from "@/db/schema";
import { requireAdminApi } from "@/lib/auth";
import { getOwnedChild } from "@/lib/data-access";
import { apiError, handleRouteError } from "@/lib/http";
import { signalLiveScreenRequest } from "@/realtime";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const { admin, response } = await requireAdminApi();
    if (response) return response;

    const child = await getOwnedChild(id, admin.id);
    if (!child) return apiError(404, "Child not found");

    const [session] = await db
      .insert(liveScreenSessions)
      .values({ childId: id, adminId: admin.id, status: "requested" })
      .returning();

    const signaling = await signalLiveScreenRequest(session.id);

    return NextResponse.json({ session, signaling }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
