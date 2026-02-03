import { NextResponse } from "next/server";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const companyId = await getActiveCompanyId();
  const { id } = await params;
  const doorId = String(id ?? "").trim();

  if (!doorId) return NextResponse.json({ error: "id zorunlu" }, { status: 400 });

  const body = await req.json().catch(() => ({} as any));

  // Partial update: only update fields that are present in request body.
  const data: any = {};

  // defaultDirection update (IN | OUT | null)
  if (Object.prototype.hasOwnProperty.call(body, "defaultDirection")) {
    const raw = body.defaultDirection;
    const defaultDirection =
      raw === null || raw === "" || raw === undefined
        ? null
        : raw === "IN"
        ? "IN"
        : raw === "OUT"
        ? "OUT"
        : null;
    data.defaultDirection = defaultDirection;
  }

  // isActive update (boolean)
  if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "isActive boolean olmalı" }, { status: 400 });
    }
    data.isActive = body.isActive;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "PATCH body boş (güncellenecek alan yok)" }, { status: 400 });
  }

  const exists = await prisma.door.findFirst({
    where: { id: doorId, companyId },
    select: { id: true },
  });

  if (!exists) return NextResponse.json({ error: "Kapı bulunamadı" }, { status: 404 });

  const updated = await prisma.door.update({
    where: { id: doorId },
    data,
    select: { id: true, branchId: true, code: true, name: true, role: true, isActive: true, defaultDirection: true },
  });

  return NextResponse.json(updated);
}
