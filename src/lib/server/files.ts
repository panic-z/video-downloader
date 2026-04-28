import { existsSync } from "node:fs";
import type { DownloadJob } from "@/lib/video/types";

export function resolveCompletedFile(
  job: DownloadJob | null,
  exists: (path: string) => boolean = existsSync
): { path: string; fileName: string } | null {
  if (!job || job.status !== "completed" || !job.filePath || !job.fileName) {
    return null;
  }

  if (!exists(job.filePath)) {
    return null;
  }

  return { path: job.filePath, fileName: job.fileName };
}
