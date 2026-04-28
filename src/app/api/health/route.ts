import { NextResponse } from "next/server";
import { checkDependencies } from "@/lib/server/dependencies";

export async function GET() {
  return NextResponse.json({ dependencies: await checkDependencies() });
}
