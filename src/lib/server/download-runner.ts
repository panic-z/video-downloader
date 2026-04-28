import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { buildDownloadFileName } from "@/lib/video/filenames";
import { parseDownloadProgress } from "@/lib/video/progress";
import type { DownloadJob } from "@/lib/video/types";
import type { createJobStore } from "./job-store";
import { buildDownloadArgs } from "./yt-dlp";

type JobStore = ReturnType<typeof createJobStore>;
type SpawnFn = typeof nodeSpawn;

function resolveCompletedOutput(downloadDir: string, outputStem: string, fallbackPath: string) {
  try {
    const match = readdirSync(downloadDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && path.parse(entry.name).name === outputStem)
      .map((entry) => entry.name)
      .sort()[0];

    if (match) {
      return {
        fileName: match,
        filePath: path.join(downloadDir, match)
      };
    }
  } catch {
    return {
      fileName: path.basename(fallbackPath),
      filePath: fallbackPath
    };
  }

  return {
    fileName: path.basename(fallbackPath),
    filePath: fallbackPath
  };
}

export function startDownload(input: {
  job: DownloadJob;
  url: string;
  formatId: string;
  extension: string | null;
  downloadDir: string;
  store: JobStore;
  spawn?: SpawnFn;
}): void {
  const spawn = input.spawn ?? nodeSpawn;
  mkdirSync(input.downloadDir, { recursive: true });

  const baseName = buildDownloadFileName(input.job.title, input.job.jobId, input.extension);
  const outputStem = path.basename(baseName, path.extname(baseName));
  const outputTemplate = path.join(input.downloadDir, `${outputStem}.%(ext)s`);
  const expectedPath = path.join(input.downloadDir, baseName);
  const args = buildDownloadArgs({
    url: input.url,
    formatId: input.formatId,
    outputTemplate
  });

  input.store.update(input.job.jobId, {
    status: "running",
    fileName: baseName,
    filePath: expectedPath,
    progress: 0
  });

  const child = spawn("yt-dlp", args) as ChildProcessWithoutNullStreams;
  let lastError = "";
  let terminalStateSet = false;

  function setTerminalState(patch: Partial<DownloadJob>) {
    if (terminalStateSet) return;
    terminalStateSet = true;
    input.store.update(input.job.jobId, patch);
  }

  child.stdout.on("data", (chunk) => {
    const lines = String(chunk).split(/\r?\n/);
    for (const line of lines) {
      const progress = parseDownloadProgress(line);
      if (progress !== null) input.store.update(input.job.jobId, { progress });
    }
  });

  child.stderr.on("data", (chunk) => {
    lastError = String(chunk).trim() || lastError;
  });

  child.on("error", (error) => {
    setTerminalState({
      status: "failed",
      error: error.message
    });
  });

  child.on("close", (code) => {
    if (code === 0) {
      const completedOutput = resolveCompletedOutput(input.downloadDir, outputStem, expectedPath);
      setTerminalState({ status: "completed", progress: 100, ...completedOutput });
      return;
    }

    setTerminalState({
      status: "failed",
      error: lastError || `yt-dlp exited with code ${code}`
    });
  });
}
