import { NextResponse } from "next/server";
import { adminSessionToken } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const password = process.env.ADMIN_PASSWORD;
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("setlib_admin="))?.slice("setlib_admin=".length);
  return NextResponse.json({ authenticated: Boolean(password && cookie && cookie === await adminSessionToken(password)) });
}

export async function POST(request: Request) {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) {
    return NextResponse.json({ error: "Set ADMIN_PASSWORD in your environment before using the admin area." }, { status: 503 });
  }
  const body: unknown = await request.json().catch(() => null);
  if (
    !body ||
    typeof body !== "object" ||
    !("password" in body) ||
    typeof body.password !== "string" ||
    body.password !== configuredPassword
  ) {
    return NextResponse.json({ error: "Incorrect admin password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("setlib_admin", await adminSessionToken(configuredPassword), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("setlib_admin", "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
