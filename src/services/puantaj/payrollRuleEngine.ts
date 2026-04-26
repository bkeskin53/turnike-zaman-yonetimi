import type { PuantajDailyRow } from "@/src/services/puantaj/types";

export type PayrollRuleCode =
  | "NORMAL_WORK"
  | "OVERTIME"
  | "OVERTIME_EARLY"
  | "OVERTIME_LATE"
  | "OFF_DAY_WORK"
  | "HOLIDAY_WORK"
  | "HOLIDAY_OT"
  | "NIGHT_PREMIUM"
  | "PAID_LEAVE"
  | "UNPAID_LEAVE";

export type PayrollRuleSource =
  | "ATTENDANCE"
  | "OVERTIME"
  | "LEAVE"
  | "HOLIDAY"
  | "NIGHT"
  | "SYSTEM";

export type PayrollRulePassName =
  | "BASE_WORK"
  | "OVERTIME_SPLIT"
  | "HOLIDAY_OVERRIDE"
  | "NIGHT_PREMIUM"
  | "LEAVE_TRANSFORM";

export const PAYROLL_RULE_ENGINE_VERSION = "F6.1";

export const PAYROLL_RULE_PASS_ORDER: PayrollRulePassName[] = [
  "BASE_WORK",
  "OVERTIME_SPLIT",
  "HOLIDAY_OVERRIDE",
  "NIGHT_PREMIUM",
  "LEAVE_TRANSFORM",
];

export interface PayrollRuleLine {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  dayKey: string;

  code: PayrollRuleCode;
  source: PayrollRuleSource;

  minutes: number;
  quantityHint?: number | null;

  meta?: {
    rulePass: PayrollRulePassName;
    note?: string;
  };
}

export interface PayrollRuleEngineDiagnostics {
  version: string;
  employeeId: string;
  employeeCode: string;
  dayKey: string;
  orderedPasses: PayrollRulePassName[];
  legacyPuantajCodes: string[];
  context: {
    isHoliday: boolean;
    holidayName: string | null;
    nightMinutes: number;
    nightWindowLabel: string | null;
  };
}

export interface PayrollRuleEngineResult {
  lines: PayrollRuleLine[];
  diagnostics: PayrollRuleEngineDiagnostics;
}

export interface PayrollRuleEngineContext {
  isHoliday?: boolean;
  holidayName?: string | null;
  nightMinutes?: number;
  nightWindowLabel?: string | null;
}

type PayrollRuleEngineState = {
  row: PuantajDailyRow;
  lines: PayrollRuleLine[];
  diagnostics: PayrollRuleEngineDiagnostics;
};

type PayrollRulePassFn = (state: PayrollRuleEngineState) => PayrollRuleEngineState;

function buildLine(
  row: PuantajDailyRow,
  input: {
    code: PayrollRuleCode;
    source: PayrollRuleSource;
    minutes: number;
    quantityHint?: number | null;
    rulePass: PayrollRulePassName;
    note?: string;
  }
): PayrollRuleLine {
  return {
    employeeId: row.employeeId,
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    dayKey: row.dayKey,
    code: input.code,
    source: input.source,
    minutes: input.minutes,
    quantityHint: input.quantityHint ?? null,
    meta: {
      rulePass: input.rulePass,
      note: input.note,
    },
  };
}

function appendLine(
  state: PayrollRuleEngineState,
  line: PayrollRuleLine
): PayrollRuleEngineState {
  return {
    ...state,
    lines: [...state.lines, line],
  };
}

function createInitialState(
  row: PuantajDailyRow,
  context?: PayrollRuleEngineContext
): PayrollRuleEngineState {
  return {
    row,
    lines: [],
    diagnostics: {
      version: PAYROLL_RULE_ENGINE_VERSION,
      employeeId: row.employeeId,
      employeeCode: row.employeeCode,
      dayKey: row.dayKey,
      orderedPasses: [...PAYROLL_RULE_PASS_ORDER],
      legacyPuantajCodes: [...row.puantajCodes],
      context: {
        isHoliday: !!context?.isHoliday,
        holidayName: context?.holidayName ?? null,
        nightMinutes: Math.max(0, context?.nightMinutes ?? 0),
        nightWindowLabel: context?.nightWindowLabel ?? null,
      },
    },
  };
}

const baseWorkPass: PayrollRulePassFn = (state) => {
  const { row } = state;

  if (row.status !== "PRESENT") {
    return state;
  }

  if (row.workedMinutes <= 0) {
    return state;
  }

  return appendLine(
    state,
    buildLine(row, {
      code: "NORMAL_WORK",
      source: "ATTENDANCE",
      minutes: row.workedMinutes,
      quantityHint: null,
      rulePass: "BASE_WORK",
      note: "Base work extracted from workedMinutes.",
    })
  );
};

const overtimeSplitPass: PayrollRulePassFn = (state) => {
  const { row } = state;
  let nextState = state;

  if (row.overtimeEarlyMinutes > 0) {
    nextState = appendLine(
      nextState,
      buildLine(row, {
        code: "OVERTIME_EARLY",
        source: "OVERTIME",
        minutes: row.overtimeEarlyMinutes,
        quantityHint: null,
        rulePass: "OVERTIME_SPLIT",
        note: "Early overtime extracted from overtimeEarlyMinutes.",
      })
    );
  }

  if (row.overtimeLateMinutes > 0) {
    nextState = appendLine(
      nextState,
      buildLine(row, {
        code: "OVERTIME_LATE",
        source: "OVERTIME",
        minutes: row.overtimeLateMinutes,
        quantityHint: null,
        rulePass: "OVERTIME_SPLIT",
        note: "Late overtime extracted from overtimeLateMinutes.",
      })
    );
  }

  return nextState;
};

const holidayOverridePass: PayrollRulePassFn = (state) => {
  const { row, diagnostics } = state;

  if (!diagnostics.context.isHoliday) {
    return state;
  }

  let nextState = state;
  const holidayLabel = diagnostics.context.holidayName ?? "Holiday";

  if (row.workedMinutes > 0) {
    nextState = appendLine(nextState, {
      employeeId: row.employeeId,
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      dayKey: row.dayKey,
      code: "HOLIDAY_WORK",
      source: "HOLIDAY",
      minutes: row.workedMinutes,
      quantityHint: null,
      meta: {
        rulePass: "HOLIDAY_OVERRIDE",
        note: `${holidayLabel} work extracted from workedMinutes.`,
      },
    });
  }

  const holidayOtMinutes = Math.max(0, row.overtimeEarlyMinutes) + Math.max(0, row.overtimeLateMinutes);

  if (holidayOtMinutes > 0) {
    nextState = appendLine(nextState, {
      employeeId: row.employeeId,
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      dayKey: row.dayKey,
      code: "HOLIDAY_OT",
      source: "HOLIDAY",
      minutes: holidayOtMinutes,
      quantityHint: null,
      meta: {
        rulePass: "HOLIDAY_OVERRIDE",
        note: `${holidayLabel} overtime extracted from overtime split minutes.`,
      },
    });
  }

  return nextState;
};

const offDayWorkPass: PayrollRulePassFn = (state) => {
  const { row } = state;

  if (row.status !== "OFF") {
    return state;
  }

  if (row.workedMinutes <= 0) {
    return state;
  }

  return appendLine(state, {
    employeeId: row.employeeId,
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    dayKey: row.dayKey,
    code: "OFF_DAY_WORK",
    source: "ATTENDANCE",
    minutes: row.workedMinutes,
    quantityHint: null,
    meta: {
      rulePass: "HOLIDAY_OVERRIDE",
      note: "Off day work extracted from workedMinutes on OFF status.",
    },
  });
};

const leaveTransformPass: PayrollRulePassFn = (state) => {
  const { row } = state;

  if (row.status !== "LEAVE") {
    return state;
  }

  if (!row.leaveType) {
    return state;
  }

  const code: PayrollRuleCode =
    row.leaveType === "UNPAID" ? "UNPAID_LEAVE" : "PAID_LEAVE";

  const note =
    row.leaveType === "UNPAID"
      ? "Unpaid leave transformed from leaveType."
      : "Paid leave transformed from leaveType.";

  return appendLine(state, {
    employeeId: row.employeeId,
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    dayKey: row.dayKey,
    code,
    source: "LEAVE",
    minutes: 0,
    quantityHint: 1,
    meta: {
      rulePass: "LEAVE_TRANSFORM",
      note,
    },
  });
};

const nightPremiumPass: PayrollRulePassFn = (state) => {
  const { row, diagnostics } = state;
  const nightMinutes = Math.max(0, diagnostics.context.nightMinutes ?? 0);

  if (nightMinutes <= 0) {
    return state;
  }

  const windowLabel = diagnostics.context.nightWindowLabel ?? "Night window";

  return appendLine(state, {
    employeeId: row.employeeId,
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    dayKey: row.dayKey,
    code: "NIGHT_PREMIUM",
    source: "NIGHT",
    minutes: nightMinutes,
    quantityHint: null,
    meta: {
      rulePass: "NIGHT_PREMIUM",
      note: `${windowLabel} premium extracted from context.nightMinutes.`,
    },
  });
};

const noopPasses: Record<PayrollRulePassName, PayrollRulePassFn> = {
  BASE_WORK: baseWorkPass,
  OVERTIME_SPLIT: overtimeSplitPass,
  HOLIDAY_OVERRIDE: (state) => {
    const afterOffDay = offDayWorkPass(state);
    return holidayOverridePass(afterOffDay);
  },
  NIGHT_PREMIUM: nightPremiumPass,
  LEAVE_TRANSFORM: leaveTransformPass,
};

export function evaluatePayrollRuleEngine(
  row: PuantajDailyRow,
  context?: PayrollRuleEngineContext
): PayrollRuleEngineResult {
  let state = createInitialState(row, context);

  for (const passName of PAYROLL_RULE_PASS_ORDER) {
    state = noopPasses[passName](state);
  }

  return {
    lines: [...state.lines],
    diagnostics: {
      ...state.diagnostics,
      orderedPasses: [...state.diagnostics.orderedPasses],
      legacyPuantajCodes: [...state.diagnostics.legacyPuantajCodes],
    },
  };
}