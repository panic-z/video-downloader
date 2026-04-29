import { EventEmitter } from "node:events";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { startDownload } from "./download-runner";
import { createJobStore } from "./job-store";

function childProcessMock() {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  return proc;
}

describe("startDownload", () => {
  it("marks a job completed when the child exits successfully", async () => {
    const store = createJobStore(() => 1000);
    const job = store.create({ title: "Title" });
    const proc = childProcessMock();
    const spawn = vi.fn().mockReturnValue(proc);
    const downloadDir = mkdtempSync(path.join(tmpdir(), "video-downloader-"));

    startDownload({
      job,
      url: "https://youtu.be/id",
      formatId: "18",
      extension: "mp4",
      downloadDir,
      store,
      spawn
    });

    const initialJob = store.get(job.jobId);
    writeFileSync(path.join(downloadDir, initialJob?.fileName ?? "missing.mp4"), "output");
    proc.stdout.emit("data", Buffer.from("[download]  50.0% of 10MiB\n"));
    proc.emit("close", 0);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.get(job.jobId)).toMatchObject({ status: "completed", progress: 100 });
  });

  it("updates completed jobs to the actual merged output file extension", async () => {
    const store = createJobStore(() => 1000);
    const job = store.create({ title: "Title" });
    const proc = childProcessMock();
    const spawn = vi.fn().mockReturnValue(proc);
    const downloadDir = mkdtempSync(path.join(tmpdir(), "video-downloader-"));

    startDownload({
      job,
      url: "https://youtu.be/id",
      formatId: "137+bestaudio/137",
      extension: "webm",
      downloadDir,
      store,
      spawn
    });

    const initialJob = store.get(job.jobId);
    expect(initialJob?.fileName).toMatch(/^Title-job-[^.]+\.webm$/);
    const outputStem = path.basename(initialJob?.fileName ?? "", ".webm");

    writeFileSync(path.join(downloadDir, `${outputStem}.mp4`), "merged output");
    proc.emit("close", 0);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.get(job.jobId)).toMatchObject({
      status: "completed",
      fileName: `${outputStem}.mp4`,
      filePath: path.join(downloadDir, `${outputStem}.mp4`)
    });
  });

  it("marks a job failed when yt-dlp exits successfully without producing a file", async () => {
    const store = createJobStore(() => 1000);
    const job = store.create({ title: "Title" });
    const proc = childProcessMock();
    const spawn = vi.fn().mockReturnValue(proc);
    const downloadDir = mkdtempSync(path.join(tmpdir(), "video-downloader-"));

    startDownload({
      job,
      url: "https://youtu.be/id",
      formatId: "18",
      extension: "mp4",
      downloadDir,
      store,
      spawn
    });

    proc.emit("close", 0);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.get(job.jobId)).toMatchObject({
      status: "failed",
      error: "Download finished but the output file was not found."
    });
  });

  it("marks a job failed when the child exits with an error", async () => {
    const store = createJobStore(() => 1000);
    const job = store.create({ title: "Title" });
    const proc = childProcessMock();
    const spawn = vi.fn().mockReturnValue(proc);

    startDownload({
      job,
      url: "https://youtu.be/id",
      formatId: "18",
      extension: "mp4",
      downloadDir: "/tmp/downloads",
      store,
      spawn
    });

    proc.stderr.emit("data", Buffer.from("format unavailable"));
    proc.emit("close", 1);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.get(job.jobId)).toMatchObject({ status: "failed", error: "format unavailable" });
  });

  it("reports the terminating signal when yt-dlp is killed", async () => {
    const store = createJobStore(() => 1000);
    const job = store.create({ title: "Title" });
    const proc = childProcessMock();
    const spawn = vi.fn().mockReturnValue(proc);

    startDownload({
      job,
      url: "https://youtu.be/id",
      formatId: "18",
      extension: "mp4",
      downloadDir: "/tmp/downloads",
      store,
      spawn
    });

    proc.emit("close", null, "SIGTERM");

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.get(job.jobId)).toMatchObject({
      status: "failed",
      error: "yt-dlp was terminated by signal SIGTERM"
    });
  });

  it("keeps the original spawn error when close follows", async () => {
    const store = createJobStore(() => 1000);
    const job = store.create({ title: "Title" });
    const proc = childProcessMock();
    const spawn = vi.fn().mockReturnValue(proc);

    startDownload({
      job,
      url: "https://youtu.be/id",
      formatId: "18",
      extension: "mp4",
      downloadDir: "/tmp/downloads",
      store,
      spawn
    });

    proc.emit("error", new Error("spawn failed"));
    proc.emit("close", 0);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.get(job.jobId)).toMatchObject({ status: "failed", error: "spawn failed" });
  });
});
