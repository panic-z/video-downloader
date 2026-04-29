import { NextResponse } from "next/server";
import { checkDependencies } from "@/lib/server/dependencies";
import { getRuntimeMode, localFirstWarning } from "@/lib/server/runtime";

export async function GET() {
  const mode = getRuntimeMode();

  return NextResponse.json({
    mode,
    ...(mode === "vercel" ? { warning: localFirstWarning } : {}),
    dependencies: await checkDependencies()
  });
}
