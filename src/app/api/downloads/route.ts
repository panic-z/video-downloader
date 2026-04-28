import path from "node:path";
import { NextResponse } from "next/server";
import { parseSupportedVideoUrl } from "@/lib/video/url";
import { jsonError, readJsonBody } from "@/lib/server/api-errors";
import { jobStore } from "@/lib/server/job-store";
import { startDownload } from "@/lib/server/download-runner";

export async function POST(request: Request) {
  const body = await readJsonBody<{
    url?: unknown;
    formatId?: unknown;
    title?: unknown;
    extension?: unknown;
  }>(request);

  if (
    !body ||
    typeof body.url !== "string" ||
    typeof body.formatId !== "string" ||
    !body.formatId.trim()
  ) {
    return jsonError("A video URL and format id are required.", 400);
  }

  const parsed = parseSupportedVideoUrl(body.url);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const title = typeof body.title === "string" && body.title.trim() ? body.title : "Untitled video";
  const extension = typeof body.extension === "string" ? body.extension : null;
  const job = jobStore.create({ title });

  try {
    startDownload({
      job,
      url: parsed.url,
      formatId: body.formatId.trim(),
      extension,
      downloadDir: path.join(process.cwd(), "downloads"),
      store: jobStore
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start download.";
    jobStore.update(job.jobId, { status: "failed", error: message });
    return jsonError(`Failed to start download: ${message}`, 500);
  }

  return NextResponse.json({ jobId: job.jobId, status: job.status });
}
