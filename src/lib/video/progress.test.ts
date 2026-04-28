import { describe, expect, it } from "vitest";
import { parseDownloadProgress } from "./progress";

describe("parseDownloadProgress", () => {
  it("parses yt-dlp percentage output", () => {
    expect(parseDownloadProgress("[download]  62.3% of 10.00MiB at 1.00MiB/s ETA 00:04")).toBe(62.3);
  });

  it("rounds completed output to 100", () => {
    expect(parseDownloadProgress("[download] 100% of 10.00MiB in 00:10")).toBe(100);
  });

  it("returns null when no percentage is present", () => {
    expect(parseDownloadProgress("Deleting original file")).toBeNull();
  });
});
