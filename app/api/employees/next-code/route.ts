import { NextResponse } from "next/server";
import { requireRole } from "@/src/auth/guard";
import { ROLE_SETS } from "@/src/auth/roleSets";
import { authErrorResponse } from "@/src/auth/http";
import { getActiveCompanyId } from "@/src/services/company.service";
import {
  EmployeeCodeSequenceError,
  resolveNextEmployeeCode,
} from "@/src/services/employees/employeeCodeSequence.service";

export async function GET() {
  try {
    await requireRole(ROLE_SETS.READ_ALL);

    const companyId = await getActiveCompanyId();
    const employeeCode = await resolveNextEmployeeCode({ companyId });

    return NextResponse.json({
      employeeCode,
    });
  } catch (error) {
    if (error instanceof EmployeeCodeSequenceError) {
      if (error.code === "EMPLOYEE_CODE_SEQUENCE_EXHAUSTED") {
        return NextResponse.json(
          { error: "EMPLOYEE_CODE_SEQUENCE_EXHAUSTED" },
          { status: 409 },
        );
      }
    }

    const authResponse = authErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    throw error;
  }
}