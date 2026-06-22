import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { webFilterRules } from "@/db/schema";
import { requireAdminApi } from "@/lib/auth";
import { getOwnedWebRule } from "@/lib/data-access";
import { apiError, handleRouteError } from "@/lib/http";
import { updateWebRuleSchema } from "@/lib/validators";

type Context = { params: Promise<{ ruleId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { ruleId } = await params;
    const { admin, response } = await requireAdminApi();
    if (response) return response;

    const existing = await getOwnedWebRule(ruleId, admin.id);
    if (!existing) return apiError(404, "Web rule not found");

    const body = updateWebRuleSchema.parse(await request.json());
    const [rule] = await db
      .update(webFilterRules)
      .set({
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.isBlocked !== undefined ? { isBlocked: body.isBlocked } : {})
      })
      .where(eq(webFilterRules.id, ruleId))
      .returning();

    return NextResponse.json({ rule });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const { ruleId } = await params;
  const { admin, response } = await requireAdminApi();
  if (response) return response;

  const existing = await getOwnedWebRule(ruleId, admin.id);
  if (!existing) return apiError(404, "Web rule not found");

  await db.delete(webFilterRules).where(eq(webFilterRules.id, ruleId));
  return NextResponse.json({ ok: true });
}
