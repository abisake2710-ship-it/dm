import { NextResponse } from "next/server";
import { createMember, listMembers } from "@/lib/firestore";
import { requireAdmin } from "@/lib/require-admin";
import { memberSchema } from "@/lib/schemas";
import { isUniqueConstraintError } from "@/lib/loan-service";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json(await listMembers());
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const parsed = memberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid member data." }, { status: 400 });
  }
  try {
    return NextResponse.json(await createMember(parsed.data), { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "A member with that email already exists." }, { status: 409 });
    }
    console.error("Could not create member:", error);
    return NextResponse.json({ error: "Could not create member." }, { status: 500 });
  }
}
