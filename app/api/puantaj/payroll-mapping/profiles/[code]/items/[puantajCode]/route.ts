import { NextResponse } from "next/server";
import type {
  PuantajCode,
  PuantajPayrollQuantityStrategy,
  PuantajPayrollQuantityUnit,
} from "@/src/services/puantaj/types";
import { getActiveCompanyId } from "@/src/services/company.service";
import {
  deactivatePayrollCodeMappingItem,
  upsertPayrollCodeMappingItem,
} from "@/src/services/puantaj/payrollCodeMappingDb.service";
import {
  requirePayrollMappingWriteSession,
  resolvePayrollMappingActorUserId,
} from "@/app/api/puantaj/payroll-mapping/_auth";
import {
  logPayrollMappingItemDeactivated,
  logPayrollMappingItemUpserted,
} from "@/src/services/puantaj/audit.service";

const VALID_PUANTAJ_CODES: PuantajCode[] = [
  "NORMAL_WORK",
  "OVERTIME",
  "OFF_DAY",
  "ABSENCE",
  "LEAVE_ANNUAL",
  "LEAVE_SICK",
  "LEAVE_EXCUSED",
  "LEAVE_UNPAID",
  "LEAVE_UNKNOWN",
];

function isPuantajCode(value: string): value is PuantajCode {
  return VALID_PUANTAJ_CODES.includes(value as PuantajCode);
}

function parseUnit(value: unknown): PuantajPayrollQuantityUnit {
  if (value === "MINUTES") return "MINUTES";
  if (value === "COUNT") return "COUNT";
  return "DAYS";
}

function parseQuantityStrategy(value: unknown): PuantajPayrollQuantityStrategy {
  switch (value) {
    case "WORKED_MINUTES":
      return "WORKED_MINUTES";
    case "OVERTIME_MINUTES":
      return "OVERTIME_MINUTES";
    case "FIXED_QUANTITY":
      return "FIXED_QUANTITY";
    default:
      throw new Error("BAD_QUANTITY_STRATEGY");
  }
}

function roundFixedQuantity(value: number) {
  return Math.round(value * 100) / 100;
}

function parseFixedQuantity(
  value: unknown,
  quantityStrategy: PuantajPayrollQuantityStrategy
): number | null {
  if (quantityStrategy !== "FIXED_QUANTITY") {
    return null;
  }

  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("BAD_FIXED_QUANTITY");
  }

  return roundFixedQuantity(n);
}

type RouteContext = {
  params: Promise<{
    code: string;
    puantajCode: string;
  }>;
};

export async function PUT(req: Request, context: RouteContext) {
  const auth = await requirePayrollMappingWriteSession();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body: any = await req.json().catch(() => ({}));
    const { code: rawCode, puantajCode: rawPuantajCode } = await context.params;
    const puantajCode = String(rawPuantajCode ?? "");
    if (!isPuantajCode(puantajCode)) {
      return NextResponse.json({ error: "BAD_PUANTAJ_CODE" }, { status: 400 });
    }

    const unit = parseUnit(body?.unit);
    const quantityStrategy = parseQuantityStrategy(body?.quantityStrategy);
    const fixedQuantity = parseFixedQuantity(body?.fixedQuantity, quantityStrategy);

    const companyId = await getActiveCompanyId();
    const actorUserId = await resolvePayrollMappingActorUserId(auth.session);   
    const profile = await upsertPayrollCodeMappingItem({
      companyId,
      profileCode: String(rawCode ?? ""),
      puantajCode,
      payrollCode: String(body?.payrollCode ?? ""),
      payrollLabel: String(body?.payrollLabel ?? ""),
      unit,
      quantityStrategy,
      fixedQuantity,
      sortOrder: body?.sortOrder,
      isActive: body?.isActive == null ? true : !!body.isActive,
    });

    const updatedItem = profile?.items.find((x) => x.puantajCode === puantajCode);
    if (updatedItem) {
      await logPayrollMappingItemUpserted({
        companyId,
        actorUserId,
        profileCode: String(rawCode ?? "").trim().toUpperCase(),
        puantajCode,
        payrollCode: updatedItem.payrollCode,
        payrollLabel: updatedItem.payrollLabel,
        unit: updatedItem.unit,
        quantityStrategy: updatedItem.quantityStrategy,
        fixedQuantity: updatedItem.fixedQuantity,
        sortOrder: updatedItem.sortOrder,
        isActive: updatedItem.isActive,
      });
    }

    return NextResponse.json({
      ok: true,
      profile,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message ?? "ITEM_UPSERT_FAILED",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  const auth = await requirePayrollMappingWriteSession();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { code: rawCode, puantajCode: rawPuantajCode } = await context.params;
    const puantajCode = String(rawPuantajCode ?? "");
    if (!isPuantajCode(puantajCode)) {
      return NextResponse.json({ error: "BAD_PUANTAJ_CODE" }, { status: 400 });
    }

    const companyId = await getActiveCompanyId();
    const actorUserId = await resolvePayrollMappingActorUserId(auth.session);   
    const profile = await deactivatePayrollCodeMappingItem({
      companyId,
      profileCode: String(rawCode ?? ""),
      puantajCode,
    });

    await logPayrollMappingItemDeactivated({
      companyId,
      actorUserId,
      profileCode: String(rawCode ?? "").trim().toUpperCase(),
      puantajCode,
    });

    return NextResponse.json({
      ok: true,
      profile,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message ?? "ITEM_DELETE_FAILED",
      },
      { status: 400 }
    );
  }
}