import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/authorization";
import { createStaff, deleteStaff, listStaff, updateStaff, type StaffInput } from "@/lib/repositories";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, staff: await listStaff() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ["admin"]);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as StaffInput;
    const validation = validateStaff(body);
    if (validation) {
      return NextResponse.json({ ok: false, message: validation }, { status: 422 });
    }

    const staff = await createStaff(body);
    return NextResponse.json({ ok: true, staff }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = requireRole(request, ["admin"]);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as Partial<StaffInput> & { id?: string };
    if (!body.id) {
      return NextResponse.json({ ok: false, message: "Missing staff id" }, { status: 422 });
    }

    const staff = await updateStaff(body.id, body);
    if (!staff) {
      return NextResponse.json({ ok: false, message: "Staff not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, staff });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = requireRole(request, ["admin"]);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, message: "Missing staff id" }, { status: 422 });
    }

    const deleted = await deleteStaff(id);
    if (!deleted) {
      return NextResponse.json({ ok: false, message: "Staff not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

function validateStaff(input: StaffInput): string | null {
  if (!input.name?.trim()) return "Missing staff name";
  if (!input.email?.trim()) return "Missing staff email";
  if (!input.username?.trim()) return "Missing staff username";
  if (!input.password?.trim()) return "Missing staff password";
  if (input.password.trim().length < 8) return "Password must be at least 8 characters";
  if (!["admin", "manager", "viewer"].includes(input.role)) return "Invalid staff role";
  return null;
}
