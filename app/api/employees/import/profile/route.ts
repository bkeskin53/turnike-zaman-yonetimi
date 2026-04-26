import { NextResponse } from "next/server";

function deprecated() {
  return NextResponse.json(
    {
      ok: false,
      error: "EMPLOYEE_IMPORT_PROFILE_DEPRECATED",
      message:
        "Personel import mapping profili kaldırıldı. İçe aktarım artık sabit şablon ve exact header sözleşmesi ile çalışır.",
    },
    { status: 410 }
  );
}

export async function GET() {
  return deprecated();
}

export async function PUT() {
  return deprecated();
}