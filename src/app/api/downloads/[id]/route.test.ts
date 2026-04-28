import { beforeEach, describe, expect, it, vi } from "vitest";

const { jobStore } = vi.hoisted(() => ({
  jobStore: {
    get: vi.fn()
  }
}));

vi.mock("@/lib/server/job-store", () => ({
  jobStore
}));

import { GET } from "./route";

describe("GET /api/downloads/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for unknown jobs", async () => {
    jobStore.get.mockReturnValue(null);

    const response = await GET(new Request("http://localhost/api/downloads/missing"), {
      params: Promise.resolve({ id: "missing" })
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Download job not found." });
  });

  it("returns public job fields without the internal file path", async () => {
    jobStore.get.mockReturnValue({
      jobId: "job-1",
      status: "completed",
      progress: 100,
      title: "Title",
      fileName: "Title-job-1.mp4",
      filePath: "/private/downloads/Title-job-1.mp4",
      error: null,
      createdAt: 1000,
      updatedAt: 2000
    });

    const response = await GET(new Request("http://localhost/api/downloads/job-1"), {
      params: Promise.resolve({ id: "job-1" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      jobId: "job-1",
      status: "completed",
      progress: 100,
      title: "Title",
      fileName: "Title-job-1.mp4",
      error: null
    });
  });
});
