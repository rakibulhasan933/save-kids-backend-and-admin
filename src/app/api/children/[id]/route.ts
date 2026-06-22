import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { children } from "@/db/schema";
import { requireAdminApi } from "@/lib/auth";
import { getOwnedChild } from "@/lib/data-access";
import { apiError, handleRouteError } from "@/lib/http";
import { updateChildSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const { admin, response } = await requireAdminApi();
  if (response) return response;

  const child = await getOwnedChild(id, admin.id);
  if (!child) return apiError(404, "Child not found");

  return NextResponse.json({ child });
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const { admin, response } = await requireAdminApi();
    if (response) return response;

    const child = await getOwnedChild(id, admin.id);
    if (!child) return apiError(404, "Child not found");

    const body = updateChildSchema.parse(await request.json());
    const [updated] = await db
      .update(children)
      .set({
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        updatedAt: new Date()
      })
      .where(eq(children.id, id))
      .returning();

    return NextResponse.json({ child: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const { admin, response } = await requireAdminApi();
  if (response) return response;

  const child = await getOwnedChild(id, admin.id);
  if (!child) return apiError(404, "Child not found");

  const [updated] = await db
    .update(children)
    .set({ status: "disabled", updatedAt: new Date() })
    .where(eq(children.id, id))
    .returning();

  return NextResponse.json({ child: updated });
}
