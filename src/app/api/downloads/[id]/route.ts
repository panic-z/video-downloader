import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-errors";
import { jobStore } from "@/lib/server/job-store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = jobStore.get(id);
  if (!job) return jsonError("Download job not found.", 404);
  return NextResponse.json({
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    title: job.title,
    fileName: job.fileName,
    error: job.error
  });
}
