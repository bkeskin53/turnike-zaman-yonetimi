import type { AttendanceReviewStatus, DailyStatus, LeaveType } from "@prisma/client";
import type { PuantajBlockReason, PuantajCode, PuantajState } from "@/src/services/puantaj/types";

function leaveTypeToCode(type: LeaveType | null): PuantajCode {
  switch (type) {
    case "ANNUAL":
      return "LEAVE_ANNUAL";
    case "SICK":
      return "LEAVE_SICK";
    case "EXCUSED":
      return "LEAVE_EXCUSED";
    case "UNPAID":
      return "LEAVE_UNPAID";
    default:
      return "LEAVE_UNKNOWN";
  }
}

export function resolvePuantajGate(input: {
  requiresReview: boolean;
  reviewStatus: AttendanceReviewStatus;
}): { puantajState: PuantajState; puantajBlockReasons: PuantajBlockReason[] } {
  const reasons: PuantajBlockReason[] = [];

  if (input.requiresReview && input.reviewStatus === "NONE") {
    reasons.push({
      code: "REVIEW_REQUIRED",
      detail: "Kayıt review gerektiriyor, henüz kullanıcı kararı verilmemiş.",
    });
  }

  if (input.reviewStatus === "PENDING") {
    reasons.push({
      code: "REVIEW_PENDING",
      detail: "Kayıt pending review durumunda, puantaj için kapatılamaz.",
    });
  }

  if (input.reviewStatus === "REJECTED") {
    reasons.push({
      code: "REVIEW_REJECTED",
      detail: "Kayıt rejected durumda, operatör müdahalesi olmadan puantaja alınmamalı.",
    });
  }

  return {
    puantajState: reasons.length > 0 ? "BLOCKED" : "READY",
    puantajBlockReasons: reasons,
  };
}

export function resolvePuantajCodes(input: {
  status: DailyStatus;
  leaveType: LeaveType | null;
  workedMinutes: number;
  overtimeMinutes: number;
}): PuantajCode[] {
  const codes = new Set<PuantajCode>();

  switch (input.status) {
    case "PRESENT":
      if (input.workedMinutes > 0) {
        codes.add("NORMAL_WORK");
      }
      break;
    case "OFF":
      codes.add("OFF_DAY");
      break;
    case "ABSENT":
      codes.add("ABSENCE");
      break;
    case "LEAVE":
      codes.add(leaveTypeToCode(input.leaveType));
      break;
  }

  if (input.overtimeMinutes > 0) {
    codes.add("OVERTIME");
  }

  return Array.from(codes);
}