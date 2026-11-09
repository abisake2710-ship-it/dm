import { NextResponse } from "next/server";
import { adminSessionToken } from "@/lib/admin-auth";

export async function requireAdmin(request: Request): Promise<NextResponse | null> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return NextResponse.json({ error: "Set ADMIN_PASSWORD to enable admin actions." }, { status: 503 });
  }
  const sessionCookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("setlib_admin="))
    ?.slice("setlib_admin=".length);
  if (sessionCookie !== (await adminSessionToken(password))) {
    return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  }
  return null;
}
