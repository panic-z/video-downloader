import { describe, expect, it } from "vitest";
import { buildDownloadFileName, sanitizeFileName } from "./filenames";

describe("sanitizeFileName", () => {
  it("removes filesystem-hostile characters", () => {
    expect(sanitizeFileName('A/B:C*D?"E<F>|G')).toBe("A_B_C_D__E_F__G");
  });

  it("falls back when the title is empty after trimming", () => {
    expect(sanitizeFileName("   ")).toBe("video");
  });
});

describe("buildDownloadFileName", () => {
  it("includes a short job suffix and extension", () => {
    expect(buildDownloadFileName("My Video", "job-abcdef123456", "mp4")).toBe("My Video-job-abcdef12.mp4");
  });
});
