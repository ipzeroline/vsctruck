import { NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  AUTH_MAX_AGE_SECONDS,
  createSessionToken,
  isAuthConfigured,
  validateCredentials,
} from "@/lib/auth";
import { validateStaffLogin } from "@/lib/repositories";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        username?: string;
        password?: string;
      }
    | null;

  if (!isAuthConfigured()) {
    return NextResponse.json(
      { ok: false, message: "ยังไม่ได้ตั้งค่า VSC_AUTH_USERNAME / VSC_AUTH_PASSWORD" },
      { status: 500 },
    );
  }

  const username = body?.username?.trim() ?? "";
  const password = body?.password ?? "";

  const staff = await validateStaffLogin(username, password);
  const validFallback = validateCredentials(username, password);

  if (!staff && !validFallback) {
    return NextResponse.json({ ok: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  const role = staff?.role ?? "admin";
  const response = NextResponse.json({
    ok: true,
    user: staff
      ? { id: staff.id, name: staff.name, username: staff.username, role: staff.role }
      : { id: "env-admin", name: "Admin", username, role: "admin" },
  });
  response.cookies.set(AUTH_COOKIE, createSessionToken(username, role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_MAX_AGE_SECONDS,
  });

  return response;
}
