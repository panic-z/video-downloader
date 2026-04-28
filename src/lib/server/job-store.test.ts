import { describe, expect, it } from "vitest";
import { createJobStore } from "./job-store";

describe("createJobStore", () => {
  it("creates and reads queued jobs", () => {
    const store = createJobStore(() => 1000);
    const job = store.create({ title: "Title" });
    expect(job.status).toBe("queued");
    expect(store.get(job.jobId)).toEqual(job);
  });

  it("updates jobs immutably", () => {
    const store = createJobStore(() => 1000);
    const job = store.create({ title: "Title" });
    const updated = store.update(job.jobId, { status: "running", progress: 25 });
    expect(updated?.status).toBe("running");
    expect(updated?.progress).toBe(25);
    expect(job.status).toBe("queued");
  });

  it("does not expose mutable stored job references", () => {
    const store = createJobStore(() => 1000);
    const job = store.create({ title: "Title" });

    job.status = "completed";

    expect(store.get(job.jobId)?.status).toBe("queued");
  });
});
