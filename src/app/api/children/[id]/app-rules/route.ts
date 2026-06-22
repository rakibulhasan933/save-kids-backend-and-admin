import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { appBlockRules } from "@/db/schema";
import { requireAdminApi } from "@/lib/auth";
import { getOwnedChild } from "@/lib/data-access";
import { apiError, handleRouteError } from "@/lib/http";
import { createAppRuleSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const { admin, response } = await requireAdminApi();
  if (response) return response;

  const child = await getOwnedChild(id, admin.id);
  if (!child) return apiError(404, "Child not found");

  const rules = await db
    .select()
    .from(appBlockRules)
    .where(eq(appBlockRules.childId, id))
    .orderBy(desc(appBlockRules.createdAt));

  return NextResponse.json({ rules });
}

export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const { admin, response } = await requireAdminApi();
    if (response) return response;

    const child = await getOwnedChild(id, admin.id);
    if (!child) return apiError(404, "Child not found");

    const body = createAppRuleSchema.parse(await request.json());
    const [rule] = await db
      .insert(appBlockRules)
      .values({
        childId: id,
        packageName: body.packageName,
        label: body.label,
        isEnabled: body.isEnabled
      })
      .returning();

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
