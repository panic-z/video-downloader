import { statSync } from "node:fs";
import type { DownloadJob } from "@/lib/video/types";

type FileStat = {
  isFile(): boolean;
};

export function resolveCompletedFile(
  job: DownloadJob | null,
  stat: (path: string) => FileStat = statSync
): { path: string; fileName: string } | null {
  if (!job || job.status !== "completed" || !job.filePath || !job.fileName) {
    return null;
  }

  try {
    if (!stat(job.filePath).isFile()) {
      return null;
    }
  } catch {
    return null;
  }

  return { path: job.filePath, fileName: job.fileName };
}
