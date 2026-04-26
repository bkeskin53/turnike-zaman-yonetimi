import { NextResponse } from "next/server";
import { getCapabilities } from "@/app/_auth/capabilities";

export async function GET() {
  const caps = await getCapabilities();
  return NextResponse.json(caps);
}