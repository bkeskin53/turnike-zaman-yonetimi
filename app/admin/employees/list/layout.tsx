import type { ReactNode } from "react";
import { redirect } from "next/navigation";

export default function AdminEmployeesListRedirectLayout(_: { children: ReactNode }) {
  redirect("/employees");
}
