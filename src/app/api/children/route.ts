import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { children } from "@/db/schema";
import { requireAdminApi } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { createChildSchema } from "@/lib/validators";

function generatePairingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

async function createUniquePairingCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generatePairingCode();
    const existing = await db.select({ id: children.id }).from(children).where(eq(children.pairingCode, code)).limit(1);
    if (existing.length === 0) return code;
  }
  throw new Error("Could not generate unique pairing code");
}

export async function GET() {
  const { admin, response } = await requireAdminApi();
  if (response) return response;

  const rows = await db
    .select()
    .from(children)
    .where(eq(children.adminId, admin.id))
    .orderBy(desc(children.createdAt));

  return NextResponse.json({ children: rows });
}

export async function POST(request: Request) {
  try {
    const { admin, response } = await requireAdminApi();
    if (response) return response;

    const body = createChildSchema.parse(await request.json());
    const [child] = await db
      .insert(children)
      .values({
        adminId: admin.id,
        displayName: body.displayName,
        pairingCode: await createUniquePairingCode()
      })
      .returning();

    return NextResponse.json({ child }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
