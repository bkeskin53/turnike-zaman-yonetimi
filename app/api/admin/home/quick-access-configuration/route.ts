import { AuditAction, AuditTargetType, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { writeAudit } from "@/src/audit/writeAudit";
import { requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { HOME_QUICK_ACCESS_CONFIGURATION_KEY } from "@/src/features/home/homeQuickAccess";
import { getActiveCompanyId } from "@/src/services/company.service";
import { resolveHomeQuickAccessConfiguration } from "@/src/services/home/homeQuickAccessConfiguration.service";
import {
  isHomeQuickAccessConfigurationMutationError,
  resetHomeQuickAccessConfiguration,
  saveHomeQuickAccessConfiguration,
} from "@/src/services/home/homeQuickAccessConfigurationMutation.service";
import { authErrorResponse } from "@/src/utils/api";

function getChangedCardIds(args: {
  before: Awaited<ReturnType<typeof resolveHomeQuickAccessConfiguration>>;
  after: Awaited<ReturnType<typeof resolveHomeQuickAccessConfiguration>>;
}) {
  const beforeMap = new Map(
    args.before.cards.map((card) => [card.id, card] as const),
  );

  return args.after.cards
    .filter((card) => {
      const previous = beforeMap.get(card.id);
      if (!previous) return true;
      return (
        previous.isVisible !== card.isVisible || previous.order !== card.order
      );
    })
    .map((card) => card.id);
}

export async function PUT(req: Request) {
  try {
    const session = await requireRole(ROLE_SETS.CONFIG_WRITE);
    const companyId = await getActiveCompanyId();
    const before = await resolveHomeQuickAccessConfiguration({ companyId });
    const body = await req.json().catch(() => null);

    const after = await saveHomeQuickAccessConfiguration({
      companyId,
      input: {
        cards: Array.isArray(body?.cards) ? body.cards : [],
      },
    });

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.CONFIGURATION_UPDATED,
      targetType: AuditTargetType.CONFIGURATION,
      targetId: HOME_QUICK_ACCESS_CONFIGURATION_KEY,
      details: {
        op: "HOME_QUICK_ACCESS_CONFIGURATION_SAVE",
        companyId,
        key: HOME_QUICK_ACCESS_CONFIGURATION_KEY,
        changedCardIds: getChangedCardIds({ before, after }),
        before,
        after,
      },
    });

    return NextResponse.json({ configuration: after });
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth && auth.status !== 500) return auth;
    if (isHomeQuickAccessConfigurationMutationError(err)) {
      return NextResponse.json({ error: err.code }, { status: 400 });
    }
    return auth ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireRole(ROLE_SETS.CONFIG_WRITE);
    const companyId = await getActiveCompanyId();
    const before = await resolveHomeQuickAccessConfiguration({ companyId });
    const after = await resetHomeQuickAccessConfiguration({ companyId });

    await writeAudit({
      req,
      actorUserId: session.userId,
      actorRole: session.role as unknown as UserRole,
      action: AuditAction.CONFIGURATION_UPDATED,
      targetType: AuditTargetType.CONFIGURATION,
      targetId: HOME_QUICK_ACCESS_CONFIGURATION_KEY,
      details: {
        op: "HOME_QUICK_ACCESS_CONFIGURATION_RESET",
        companyId,
        key: HOME_QUICK_ACCESS_CONFIGURATION_KEY,
        changedCardIds: getChangedCardIds({ before, after }),
        before,
        after,
      },
    });

    return NextResponse.json({ configuration: after });
  } catch (err) {
    const auth = authErrorResponse(err);
    if (auth && auth.status !== 500) return auth;
    if (isHomeQuickAccessConfigurationMutationError(err)) {
      return NextResponse.json({ error: err.code }, { status: 400 });
    }
    return auth ?? NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}