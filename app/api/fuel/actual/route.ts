import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/authorization";
import {
  createActualFuelRefill,
  deleteActualFuelRefill,
  listActualFuelRefills,
  type ActualFuelRefillInput,
} from "@/lib/repositories";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const labelDate = searchParams.get("labelDate");
    if (!labelDate) {
      return NextResponse.json({ ok: false, message: "Missing labelDate" }, { status: 422 });
    }

    return NextResponse.json({ ok: true, actualRefills: await listActualFuelRefills(labelDate) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ["admin", "manager"]);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as ActualFuelRefillInput;
    const validation = validateActualFuelRefill(body);
    if (validation) {
      return NextResponse.json({ ok: false, message: validation }, { status: 422 });
    }

    const actualRefill = await createActualFuelRefill(body);
    return NextResponse.json({ ok: true, actualRefill }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = requireRole(request, ["admin", "manager"]);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, message: "Missing actual refill id" }, { status: 422 });
    }

    const deleted = await deleteActualFuelRefill(id);
    if (!deleted) {
      return NextResponse.json({ ok: false, message: "Actual refill not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

function validateActualFuelRefill(input: ActualFuelRefillInput): string | null {
  if (!input.labelDate?.trim()) return "Missing labelDate";
  if (!input.registration?.trim()) return "Missing registration";
  if (typeof input.liters !== "number" || !Number.isFinite(input.liters) || input.liters <= 0) {
    return "Fuel liters must be greater than 0";
  }
  if (input.liters > 2000) return "Fuel liters is too high";
  if (input.filledAt && Number.isNaN(new Date(input.filledAt).getTime())) return "Invalid filledAt";
  return null;
}
