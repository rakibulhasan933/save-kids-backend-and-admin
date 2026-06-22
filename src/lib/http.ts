import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Invalid request body", issues: error.flatten() }, { status: 400 });
  }

  console.error(error);
  return apiError(500, "Internal server error");
}
