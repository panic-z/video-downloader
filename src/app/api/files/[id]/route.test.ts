import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";

const { jobStore, open, readFile, resolveCompletedFile } = vi.hoisted(() => ({
  jobStore: {
    get: vi.fn()
  },
  open: vi.fn(),
  readFile: vi.fn(),
  resolveCompletedFile: vi.fn()
}));

vi.mock("node:fs/promises", () => ({
  default: { open, readFile },
  open,
  readFile
}));

vi.mock("@/lib/server/files", () => ({
  resolveCompletedFile
}));

vi.mock("@/lib/server/job-store", () => ({
  jobStore
}));

import { GET } from "./route";

describe("GET /api/files/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jobStore.get.mockReturnValue({ jobId: "job-test" });
  });

  it("returns 404 when the completed file cannot be resolved", async () => {
    resolveCompletedFile.mockReturnValue(null);

    const response = await GET(new Request("http://localhost/api/files/job-test"), {
      params: Promise.resolve({ id: "job-test" })
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Completed file not found." });
    expect(open).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
  });

  it("returns 404 when the completed file becomes unavailable before streaming", async () => {
    resolveCompletedFile.mockReturnValue({
      path: "/tmp/missing-video.mp4",
      fileName: "missing-video.mp4"
    });
    open.mockRejectedValueOnce(Object.assign(new Error("missing"), { code: "ENOENT" }));

    const response = await GET(new Request("http://localhost/api/files/job-test"), {
      params: Promise.resolve({ id: "job-test" })
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Completed file not found." });
    expect(open).toHaveBeenCalledWith("/tmp/missing-video.mp4", "r");
    expect(readFile).not.toHaveBeenCalled();
  });

  it("streams completed files with attachment headers without full buffering", async () => {
    const createReadStream = vi.fn(() => Readable.from([new Uint8Array([1, 2, 3])]));
    resolveCompletedFile.mockReturnValue({
      path: "/tmp/video.mp4",
      fileName: "video.mp4"
    });
    open.mockResolvedValueOnce({
      createReadStream
    });

    const response = await GET(new Request("http://localhost/api/files/job-test"), {
      params: Promise.resolve({ id: "job-test" })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="video.mp4"; filename*=UTF-8\'\'video.mp4'
    );
    expect(open).toHaveBeenCalledWith("/tmp/video.mp4", "r");
    expect(createReadStream).toHaveBeenCalledWith();
    expect(readFile).not.toHaveBeenCalled();
    expect(await response.arrayBuffer()).toEqual(new Uint8Array([1, 2, 3]).buffer);
  });

  it("uses an encoded filename parameter with an ASCII fallback for non-ASCII downloads", async () => {
    const createReadStream = vi.fn(() => Readable.from([new Uint8Array([1])]));
    resolveCompletedFile.mockReturnValue({
      path: "/tmp/video.mp4",
      fileName: "测试 视频.mp4"
    });
    open.mockResolvedValueOnce({
      createReadStream
    });

    const response = await GET(new Request("http://localhost/api/files/job-test"), {
      params: Promise.resolve({ id: "job-test" })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="__ __.mp4"; filename*=UTF-8\'\'%E6%B5%8B%E8%AF%95%20%E8%A7%86%E9%A2%91.mp4'
    );
  });
});
