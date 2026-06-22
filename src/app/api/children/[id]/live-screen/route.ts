import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { liveScreenSessions } from "@/db/schema";
import { requireAdminApi } from "@/lib/auth";
import { getOwnedChild } from "@/lib/data-access";
import { apiError } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const { admin, response } = await requireAdminApi();
  if (response) return response;

  const child = await getOwnedChild(id, admin.id);
  if (!child) return apiError(404, "Child not found");

  const sessions = await db
    .select()
    .from(liveScreenSessions)
    .where(eq(liveScreenSessions.childId, id))
    .orderBy(desc(liveScreenSessions.createdAt))
    .limit(25);

  return NextResponse.json({ sessions });
}
