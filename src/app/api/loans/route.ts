import { NextResponse } from "next/server";
import { createLoan } from "@/lib/loan-service";
import { listLoans } from "@/lib/realtime-database";
import { requireAdmin } from "@/lib/require-admin";
import { loanSchema } from "@/lib/schemas";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json(await listLoans());
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const parsed = loanSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid loan data." }, { status: 400 });
  }
  try {
    return NextResponse.json(await createLoan(parsed.data), { status: 201 });
  } catch (error) {
    if (error instanceof Error && /not found/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error && /already on loan/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Could not create loan:", error);
    return NextResponse.json({ error: "Could not create loan." }, { status: 500 });
  }
}
