import { EventEmitter } from "node:events";
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

    startDownload({
      job,
      url: "https://youtu.be/id",
      formatId: "18",
      extension: "mp4",
      downloadDir: "/tmp/downloads",
      store,
      spawn
    });

    proc.stdout.emit("data", Buffer.from("[download]  50.0% of 10MiB\n"));
    proc.emit("close", 0);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.get(job.jobId)).toMatchObject({ status: "completed", progress: 100 });
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
