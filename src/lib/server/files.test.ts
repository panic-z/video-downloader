import { describe, expect, it, vi } from "vitest";
import { resolveCompletedFile } from "./files";

describe("resolveCompletedFile", () => {
  it("returns null for missing jobs", () => {
    expect(resolveCompletedFile(null, vi.fn())).toBeNull();
  });

  it("returns null for incomplete jobs", () => {
    expect(resolveCompletedFile({ status: "running", filePath: "/tmp/a.mp4" } as any, vi.fn())).toBeNull();
  });

  it("returns a completed existing file path", () => {
    const stat = vi.fn().mockReturnValue({ isFile: () => true });
    const job = { status: "completed", filePath: "/tmp/a.mp4", fileName: "a.mp4" } as any;
    expect(resolveCompletedFile(job, stat)).toEqual({ path: "/tmp/a.mp4", fileName: "a.mp4" });
  });

  it("returns null when the completed path is not a regular file", () => {
    const stat = vi.fn().mockReturnValue({ isFile: () => false });
    const job = { status: "completed", filePath: "/tmp/a.mp4", fileName: "a.mp4" } as any;

    expect(resolveCompletedFile(job, stat)).toBeNull();
  });
});
