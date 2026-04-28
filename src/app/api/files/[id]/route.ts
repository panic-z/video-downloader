import { open } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-errors";
import { resolveCompletedFile } from "@/lib/server/files";
import { jobStore } from "@/lib/server/job-store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const file = resolveCompletedFile(jobStore.get(id));
  if (!file) return jsonError("Completed file not found.", 404);

  try {
    const handle = await open(file.path, "r");
    const stream = Readable.toWeb(handle.createReadStream()) as ReadableStream<Uint8Array>;

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.fileName)}"`
      }
    });
  } catch {
    return jsonError("Completed file not found.", 404);
  }
}
