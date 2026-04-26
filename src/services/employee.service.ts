import { getActiveCompanyId } from "@/src/services/company.service";
import {
  createEmployeeRepo,
  deactivateEmployeeRepo,
  listEmployeesRepo,
  updateEmployeeRepo,
  type CreateEmployeeInput,
  type UpdateEmployeeInput,
} from "@/src/repositories/employee.repo";

export async function listEmployees(includeInactive = false) {
  const companyId = await getActiveCompanyId();
  return listEmployeesRepo(companyId, { includeInactive });
}

export async function createEmployee(input: CreateEmployeeInput) {
  const companyId = await getActiveCompanyId();
  return createEmployeeRepo(companyId, input);
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput) {
  const companyId = await getActiveCompanyId();
  return updateEmployeeRepo(companyId, id, input);
}

export async function deactivateEmployee(id: string) {
  const companyId = await getActiveCompanyId();
  return deactivateEmployeeRepo(companyId, id);
}
