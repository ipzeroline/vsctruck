import { NextResponse } from "next/server";
import { getSessionFromCookieHeader } from "@/lib/auth";

type Role = "admin" | "manager" | "viewer";

export function requireRole(request: Request, allowedRoles: Role[]) {
  const session = getSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, message: "กรุณาเข้าสู่ระบบก่อนใช้งาน" }, { status: 401 }),
    };
  }

  if (!allowedRoles.includes(session.role)) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, message: "ไม่มีสิทธิ์สำหรับคำสั่งนี้" }, { status: 403 }),
    };
  }

  return { ok: true as const, session };
}
