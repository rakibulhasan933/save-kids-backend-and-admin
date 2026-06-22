import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appBlockRules } from "@/db/schema";
import { requireAdminApi } from "@/lib/auth";
import { getOwnedAppRule } from "@/lib/data-access";
import { apiError, handleRouteError } from "@/lib/http";
import { updateAppRuleSchema } from "@/lib/validators";

type Context = { params: Promise<{ ruleId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { ruleId } = await params;
    const { admin, response } = await requireAdminApi();
    if (response) return response;

    const existing = await getOwnedAppRule(ruleId, admin.id);
    if (!existing) return apiError(404, "App rule not found");

    const body = updateAppRuleSchema.parse(await request.json());
    const [rule] = await db
      .update(appBlockRules)
      .set({
        ...(body.label !== undefined ? { label: body.label } : {}),
        ...(body.isEnabled !== undefined ? { isEnabled: body.isEnabled } : {})
      })
      .where(eq(appBlockRules.id, ruleId))
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

  const existing = await getOwnedAppRule(ruleId, admin.id);
  if (!existing) return apiError(404, "App rule not found");

  await db.delete(appBlockRules).where(eq(appBlockRules.id, ruleId));
  return NextResponse.json({ ok: true });
}
