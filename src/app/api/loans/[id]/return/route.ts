import { NextResponse } from "next/server";
import { returnLoan } from "@/lib/loan-service";
import { requireAdmin } from "@/lib/require-admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, context: RouteContext) {
  const unauthorized = await requireAdmin(_request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  try {
    return NextResponse.json(await returnLoan(id));
  } catch (error) {
    if (error instanceof Error && /not found/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error && /already been returned/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Could not return loan:", error);
    return NextResponse.json({ error: "Could not return loan." }, { status: 500 });
  }
}
