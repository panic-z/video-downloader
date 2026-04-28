import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-errors";
import { resolveCompletedFile } from "@/lib/server/files";
import { jobStore } from "@/lib/server/job-store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const file = resolveCompletedFile(jobStore.get(id));
  if (!file) return jsonError("Completed file not found.", 404);

  const bytes = await readFile(file.path);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.fileName)}"`
    }
  });
}
