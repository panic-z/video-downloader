import { randomUUID } from "node:crypto";
import type { DownloadJob } from "@/lib/video/types";

export function createJobStore(now: () => number = Date.now) {
  const jobs = new Map<string, DownloadJob>();

  return {
    create(input: { title: string }): DownloadJob {
      const timestamp = now();
      const job: DownloadJob = {
        jobId: `job-${randomUUID()}`,
        status: "queued",
        progress: 0,
        title: input.title,
        fileName: null,
        filePath: null,
        error: null,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      jobs.set(job.jobId, job);
      return job;
    },
    get(jobId: string): DownloadJob | null {
      return jobs.get(jobId) ?? null;
    },
    update(jobId: string, patch: Partial<DownloadJob>): DownloadJob | null {
      const current = jobs.get(jobId);
      if (!current) return null;
      const updated = { ...current, ...patch, updatedAt: now() };
      jobs.set(jobId, updated);
      return updated;
    }
  };
}

export const jobStore = createJobStore();
