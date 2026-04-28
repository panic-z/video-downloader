import { beforeEach, describe, expect, it, vi } from "vitest";

const { job, jobStore, startDownload } = vi.hoisted(() => {
  const job = {
    jobId: "job-test",
    status: "queued",
    progress: 0,
    title: "Title",
    fileName: null,
    filePath: null,
    error: null,
    createdAt: 1000,
    updatedAt: 1000
  };

  return {
    job,
    jobStore: {
      create: vi.fn(),
      get: vi.fn(),
      update: vi.fn()
    },
    startDownload: vi.fn()
  };
});

vi.mock("@/lib/server/job-store", () => ({
  jobStore
}));

vi.mock("@/lib/server/download-runner", () => ({
  startDownload
}));

import { POST } from "./route";

describe("POST /api/downloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jobStore.create.mockReturnValue({ ...job });
  });

  it("returns 400 for unsupported URLs", async () => {
    const response = await POST(new Request("http://localhost/api/downloads", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com", formatId: "18" })
    }));

    expect(response.status).toBe(400);
  });

  it("returns 400 for blank format ids", async () => {
    const response = await POST(new Request("http://localhost/api/downloads", {
      method: "POST",
      body: JSON.stringify({ url: "https://youtu.be/id", formatId: "   " })
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "A video URL and format id are required."
    });
    expect(jobStore.create).not.toHaveBeenCalled();
    expect(startDownload).not.toHaveBeenCalled();
  });

  it("creates a queued job", async () => {
    const response = await POST(new Request("http://localhost/api/downloads", {
      method: "POST",
      body: JSON.stringify({
        url: "https://youtu.be/id",
        formatId: "18",
        title: "Title",
        extension: "mp4"
      })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "queued" });
    expect(jobStore.create).toHaveBeenCalledWith({ title: "Title" });
    expect(startDownload).toHaveBeenCalledWith({
      job: expect.objectContaining({ jobId: "job-test", title: "Title" }),
      url: "https://youtu.be/id",
      formatId: "18",
      extension: "mp4",
      downloadDir: expect.stringMatching(/downloads$/),
      store: jobStore
    });
  });

  it("marks the job failed and returns a structured error when startup fails", async () => {
    startDownload.mockImplementationOnce(() => {
      throw new Error("Cannot create download directory.");
    });

    const response = await POST(new Request("http://localhost/api/downloads", {
      method: "POST",
      body: JSON.stringify({
        url: "https://youtu.be/id",
        formatId: "18",
        title: "Title",
        extension: "mp4"
      })
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to start download: Cannot create download directory."
    });
    expect(jobStore.update).toHaveBeenCalledWith("job-test", {
      status: "failed",
      error: "Cannot create download directory."
    });
  });
});
