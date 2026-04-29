import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { buildDownloadFileName } from "@/lib/video/filenames";
import { parseDownloadProgress } from "@/lib/video/progress";
import type { DownloadJob } from "@/lib/video/types";
import {
  buildBinaryEnvironment,
  resolveBinaryPath,
  resolveFfmpegLocation,
  type BinaryPaths
} from "./binaries";
import type { createJobStore } from "./job-store";
import { buildDownloadArgs } from "./yt-dlp";

type JobStore = ReturnType<typeof createJobStore>;
type SpawnFn = typeof nodeSpawn;

const MAX_ERROR_OUTPUT_LENGTH = 4096;
const MAX_STDOUT_LINE_LENGTH = 4096;
const MAX_COMPLETED_DOWNLOAD_FILES = 10;

function resolveCompletedOutput(downloadDir: string, outputStem: string) {
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
    return null;
  }

  return null;
}

function pruneOldDownloadFiles(downloadDir: string, preserveFilePath: string) {
  const preservePath = path.resolve(preserveFilePath);

  try {
    const files = readdirSync(downloadDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const filePath = path.join(downloadDir, entry.name);
        return {
          filePath,
          mtimeMs: statSync(filePath).mtimeMs
        };
      })
      .sort((a, b) => a.mtimeMs - b.mtimeMs);

    const deleteCount = files.length - MAX_COMPLETED_DOWNLOAD_FILES;
    if (deleteCount <= 0) return;

    const candidates = files.filter((file) => path.resolve(file.filePath) !== preservePath);
    for (const file of candidates.slice(0, deleteCount)) {
      unlinkSync(file.filePath);
    }
  } catch {
    // Cleanup is best-effort; it should not turn a finished download into a failed job.
  }
}

export function startDownload(input: {
  job: DownloadJob;
  url: string;
  formatId: string;
  extension: string | null;
  downloadDir: string;
  store: JobStore;
  spawn?: SpawnFn;
  binaryPaths?: BinaryPaths;
}): void {
  const spawn = input.spawn ?? nodeSpawn;
  const binaryPaths = input.binaryPaths;
  mkdirSync(input.downloadDir, { recursive: true });

  const baseName = buildDownloadFileName(input.job.title, input.job.jobId, input.extension);
  const outputStem = path.basename(baseName, path.extname(baseName));
  const outputTemplate = path.join(input.downloadDir, `${outputStem}.%(ext)s`);
  const expectedPath = path.join(input.downloadDir, baseName);
  const args = buildDownloadArgs({
    url: input.url,
    formatId: input.formatId,
    outputTemplate,
    ffmpegLocation: resolveFfmpegLocation(binaryPaths)
  });

  input.store.update(input.job.jobId, {
    status: "running",
    fileName: baseName,
    filePath: expectedPath,
    progress: 0
  });

  const child = spawn(resolveBinaryPath("yt-dlp", binaryPaths), args, {
    env: buildBinaryEnvironment(process.env, binaryPaths)
  }) as ChildProcessWithoutNullStreams;
  let stdoutLineBuffer = "";
  let errorOutput = "";
  let terminalStateSet = false;

  function updateProgressFromLine(line: string) {
    const progress = parseDownloadProgress(line);
    if (progress !== null) input.store.update(input.job.jobId, { progress });
  }

  function setTerminalState(patch: Partial<DownloadJob>) {
    if (terminalStateSet) return;
    terminalStateSet = true;
    input.store.update(input.job.jobId, patch);
  }

  child.stdout.on("data", (chunk) => {
    stdoutLineBuffer = `${stdoutLineBuffer}${String(chunk)}`;
    const lines = stdoutLineBuffer.split(/\r?\n|\r/);
    stdoutLineBuffer = lines.pop() ?? "";

    if (stdoutLineBuffer.length > MAX_STDOUT_LINE_LENGTH) {
      stdoutLineBuffer = stdoutLineBuffer.slice(-MAX_STDOUT_LINE_LENGTH);
    }

    for (const line of lines) updateProgressFromLine(line);
  });

  child.stderr.on("data", (chunk) => {
    errorOutput = `${errorOutput}${String(chunk)}`;
    if (errorOutput.length > MAX_ERROR_OUTPUT_LENGTH) {
      errorOutput = errorOutput.slice(-MAX_ERROR_OUTPUT_LENGTH);
    }
  });

  child.on("error", (error) => {
    setTerminalState({
      status: "failed",
      error: error.message
    });
  });

  child.on("close", (code, signal) => {
    if (stdoutLineBuffer) {
      updateProgressFromLine(stdoutLineBuffer);
      stdoutLineBuffer = "";
    }

    if (code === 0) {
      const completedOutput = resolveCompletedOutput(input.downloadDir, outputStem);
      if (completedOutput) {
        pruneOldDownloadFiles(input.downloadDir, completedOutput.filePath);
        setTerminalState({ status: "completed", progress: 100, ...completedOutput });
        return;
      }

      setTerminalState({
        status: "failed",
        error: "Download finished but the output file was not found."
      });
      return;
    }

    setTerminalState({
      status: "failed",
      error:
        errorOutput.trim() ||
        (signal ? `yt-dlp was terminated by signal ${signal}` : `yt-dlp exited with code ${code}`)
    });
  });
}
