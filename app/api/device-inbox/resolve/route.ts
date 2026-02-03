export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { EventDirection, EventSource, Prisma } from "@prisma/client";
import { prisma } from "@/src/repositories/prisma";
import { getActiveCompanyId } from "@/src/services/company.service";

function asStr(v: unknown) {
  return String(v ?? "").trim();
}

async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  const companyId = await getActiveCompanyId();
  const body = await safeJson(req);

  const inboxId = asStr(body.inboxId);
  const employeeId = asStr(body.employeeId);
  const allowReplaceIdentity = Boolean(body.allowReplaceIdentity);

  if (!inboxId || !employeeId) {
    return NextResponse.json(
      { ok: false, error: "inboxId ve employeeId zorunlu" },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const inbox = await tx.deviceInboxEvent.findFirst({
        where: { id: inboxId, companyId },
        select: {
          id: true,
          status: true,
          occurredAt: true,
          direction: true,
          externalRef: true,
          cardNo: true,
          deviceUserId: true,
          deviceId: true,
          doorId: true,
        },
      });

      if (!inbox) {
        return { type: "err" as const, status: 404, code: "INBOX_NOT_FOUND", error: "Inbox kaydı bulunamadı" };
      }

      if (inbox.status !== "PENDING") {
        return { type: "err" as const, status: 409, code: "INBOX_NOT_PENDING", error: "Bu kayıt artık beklemede değil." };
      }

      const employee = await tx.employee.findFirst({
        where: { id: employeeId, companyId, isActive: true },
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          cardNo: true,
          deviceUserId: true,
        },
      });

      if (!employee) {
        return { type: "err" as const, status: 404, code: "EMPLOYEE_NOT_FOUND", error: "Personel bulunamadı" };
      }

      const incomingCardNo = inbox.cardNo ?? null;
      const incomingUserId = inbox.deviceUserId ?? null;

      if (!incomingCardNo && !incomingUserId) {
        return {
          type: "err" as const,
          status: 400,
          code: "NO_IDENTITY",
          error: "Bu inbox kaydında kartNo/userId yok. Resolve edilemez.",
        };
      }

      // 1) Bu kart/user başka bir personele bağlı mı?
      let otherCardOwner: { id: string; employeeCode: string; firstName: string; lastName: string } | null = null;
      let otherUserOwner: { id: string; employeeCode: string; firstName: string; lastName: string } | null = null;

      if (incomingCardNo) {
        otherCardOwner = await tx.employee.findFirst({
          where: {
            companyId,
            isActive: true,
            cardNo: incomingCardNo,
            NOT: { id: employee.id },
          },
          select: { id: true, employeeCode: true, firstName: true, lastName: true },
        });
      }

      if (incomingUserId) {
        otherUserOwner = await tx.employee.findFirst({
          where: {
            companyId,
            isActive: true,
            deviceUserId: incomingUserId,
            NOT: { id: employee.id },
          },
          select: { id: true, employeeCode: true, firstName: true, lastName: true },
        });
      }

      // allowReplaceIdentity false ise başka birine ait kimlikleri blokla
      if (!allowReplaceIdentity) {
        if (otherCardOwner) {
          return {
            type: "err" as const,
            status: 409,
            code: "CARD_ALREADY_ASSIGNED",
            error: `Bu kart zaten ${otherCardOwner.employeeCode} - ${otherCardOwner.firstName} ${otherCardOwner.lastName} personeline bağlı.`,
          };
        }
        if (otherUserOwner) {
          return {
            type: "err" as const,
            status: 409,
            code: "USER_ALREADY_ASSIGNED",
            error: `Bu User ID zaten ${otherUserOwner.employeeCode} - ${otherUserOwner.firstName} ${otherUserOwner.lastName} personeline bağlı.`,
          };
        }
      }

      // 2) Seçilen personelde farklı kart veya user ID varsa onay gerektir
      if (!allowReplaceIdentity) {
        if (incomingCardNo && employee.cardNo && employee.cardNo !== incomingCardNo) {
          return {
            type: "err" as const,
            status: 409,
            code: "EMPLOYEE_HAS_DIFFERENT_CARD",
            error:
              "Seçtiğin personelde zaten farklı bir kart tanımlı. Yanlış eşleştirmeyi önlemek için bloklandı. (Kart değişimi olarak onaylayabilirsin.)",
            details: { current: employee.cardNo, incoming: incomingCardNo },
          };
        }
        if (incomingUserId && employee.deviceUserId && employee.deviceUserId !== incomingUserId) {
          return {
            type: "err" as const,
            status: 409,
            code: "EMPLOYEE_HAS_DIFFERENT_USER_ID",
            error:
              "Seçtiğin personelde zaten farklı bir User ID tanımlı. Yanlış eşleştirmeyi önlemek için bloklandı. (User ID değişimi olarak onaylayabilirsin.)",
            details: { current: employee.deviceUserId, incoming: incomingUserId },
          };
        }
      }

      // 3) Kimlik yazma (ASSIGN / REPLACE / NONE)
      // allowReplaceIdentity açıkken kimliği başka kişideyse oradan temizle
      let cardAction: "NONE" | "ASSIGNED" | "REPLACED" = "NONE";
      let userAction: "NONE" | "ASSIGNED" | "REPLACED" = "NONE";

      if (allowReplaceIdentity) {
        if (otherCardOwner) {
          await tx.employee.update({ where: { id: otherCardOwner.id }, data: { cardNo: null } });
        }
        if (otherUserOwner) {
          await tx.employee.update({ where: { id: otherUserOwner.id }, data: { deviceUserId: null } });
        }
      }

      const employeeUpdate: Record<string, any> = {};
      if (incomingCardNo) {
        if (!employee.cardNo) {
          employeeUpdate.cardNo = incomingCardNo;
          cardAction = "ASSIGNED";
        } else if (employee.cardNo !== incomingCardNo) {
          employeeUpdate.cardNo = incomingCardNo;
          cardAction = "REPLACED";
        }
      }
      if (incomingUserId) {
        if (!employee.deviceUserId) {
          employeeUpdate.deviceUserId = incomingUserId;
          userAction = "ASSIGNED";
        } else if (employee.deviceUserId !== incomingUserId) {
          employeeUpdate.deviceUserId = incomingUserId;
          userAction = "REPLACED";
        }
      }
      if (Object.keys(employeeUpdate).length > 0) {
        await tx.employee.update({
          where: { id: employee.id },
          data: employeeUpdate,
        });
      }

      // 4) Aynı kartNo/userId ile bekleyen tüm inbox kayıtlarını topla
      const wherePending: any = { companyId, status: "PENDING" as const };
      if (incomingCardNo && incomingUserId) {
        wherePending.OR = [{ cardNo: incomingCardNo }, { deviceUserId: incomingUserId }];
      } else if (incomingCardNo) {
        wherePending.cardNo = incomingCardNo;
      } else if (incomingUserId) {
        wherePending.deviceUserId = incomingUserId;
      }

      const pending = await tx.deviceInboxEvent.findMany({
        where: wherePending,
        select: {
          id: true,
          occurredAt: true,
          direction: true,
          externalRef: true,
          deviceId: true,
          doorId: true,
        },
        orderBy: { occurredAt: "asc" },
      });

      // 5) Aynı dakika duplicate koruması (IN/OUT ayrı)
      const occurredTimes = pending.map((x) => x.occurredAt.getTime());
      const minMs = Math.min(...occurredTimes);
      const maxMs = Math.max(...occurredTimes);
      const minOccurredAt = new Date(minMs - 2_000);
      const maxOccurredAt = new Date(maxMs + 2_000);

      const [existingIn, existingOut] = await Promise.all([
        tx.rawEvent.findMany({
          where: {
            companyId,
            employeeId: employee.id,
            direction: EventDirection.IN,
            source: EventSource.DEVICE,
            occurredAt: { gte: minOccurredAt, lte: maxOccurredAt },
          },
          select: { occurredAt: true },
        }),
        tx.rawEvent.findMany({
          where: {
            companyId,
            employeeId: employee.id,
            direction: EventDirection.OUT,
            source: EventSource.DEVICE,
            occurredAt: { gte: minOccurredAt, lte: maxOccurredAt },
          },
          select: { occurredAt: true },
        }),
      ]);

      const existingInMinute = new Set(existingIn.map((x) => Math.floor(x.occurredAt.getTime() / 60000)));
      const existingOutMinute = new Set(existingOut.map((x) => Math.floor(x.occurredAt.getTime() / 60000)));
      const batchInMinute = new Set<number>();
      const batchOutMinute = new Set<number>();

      let skippedSameMinuteCount = 0;
      const rawData: Prisma.RawEventCreateManyInput[] = [];

      for (const ev of pending) {
        const minute = Math.floor(ev.occurredAt.getTime() / 60000);
        if (ev.direction === EventDirection.IN) {
          if (existingInMinute.has(minute) || batchInMinute.has(minute)) {
            skippedSameMinuteCount++;
            continue;
          }
          batchInMinute.add(minute);
        } else {
          if (existingOutMinute.has(minute) || batchOutMinute.has(minute)) {
            skippedSameMinuteCount++;
            continue;
          }
          batchOutMinute.add(minute);
        }
        rawData.push({
          companyId,
          employeeId: employee.id,
          occurredAt: ev.occurredAt,
          direction: ev.direction,
          source: EventSource.DEVICE,
          deviceId: ev.deviceId ?? null,
          doorId: ev.doorId ?? null,
          externalRef: ev.externalRef,
        });
      }

      const created = rawData.length
        ? await tx.rawEvent.createMany({ data: rawData, skipDuplicates: true })
        : { count: 0 };

      // 6) Inbox -> RESOLVED
      await tx.deviceInboxEvent.updateMany({
        where: { id: { in: pending.map((x) => x.id) } },
        data: {
          status: "RESOLVED",
          resolvedEmployeeId: employee.id,
          resolvedAt: new Date(),
        },
      });

      return {
        type: "ok" as const,
        rawInserted: created.count,
        resolvedCount: pending.length,
        skippedSameMinuteCount,
        cardAction,
        userAction,
      };
    });

    if (result.type === "err") {
      return NextResponse.json(
        { ok: false, code: result.code, error: result.error, details: (result as any).details },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ok: true,
      rawInserted: result.rawInserted,
      resolvedCount: result.resolvedCount,
      skippedSameMinute: result.skippedSameMinuteCount > 0,
      skippedSameMinuteCount: result.skippedSameMinuteCount,
      cardAction: result.cardAction,
      userAction: result.userAction,
      wroteCardNo: result.cardAction !== "NONE",
      wroteUserId: result.userAction !== "NONE",
    });
  } catch (e: any) {
    console.error("device-inbox resolve failed", e);
    return NextResponse.json({ ok: false, error: "Resolve başarısız" }, { status: 500 });
  }
}
