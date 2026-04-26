"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { buildConfigurationCenterHref } from "@/src/features/admin/configuration/configurationUrls";

export default function EmployeeConfigurationLegacyRedirect() {
  const router = useRouter();

  useEffect(() => {
    const hash =
      typeof window !== "undefined" ? window.location.hash : undefined;

    router.replace(buildConfigurationCenterHref("employees", hash));
  }, [router]);

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden px-4 py-4 md:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="text-sm font-semibold tracking-tight text-slate-900">
          Konfigurasyon merkezine yonlendiriliyor
        </div>
      </div>
    </div>
  );
}