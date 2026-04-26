// src/auth/roleSets.ts
// Central role sets for API guards.
// IMPORTANT: UI may hide actions, but backend is the real lock.

import type { Role } from "./guard";

export const ROLE_SETS: Record<
  | "READ_ALL"
  | "CONFIG_WRITE"
  | "OPS_WRITE",
  Role[]
> = {
  READ_ALL: ["SYSTEM_ADMIN", "HR_CONFIG_ADMIN", "HR_OPERATOR", "SUPERVISOR"],
  CONFIG_WRITE: ["SYSTEM_ADMIN", "HR_CONFIG_ADMIN"],
  OPS_WRITE: ["SYSTEM_ADMIN", "HR_OPERATOR"],
};
