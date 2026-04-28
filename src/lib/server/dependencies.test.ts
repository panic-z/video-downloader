import { describe, expect, it, vi } from "vitest";
import { checkBinary, checkDependencies } from "./dependencies";

describe("checkBinary", () => {
  it("returns available true when command exits successfully", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "version", stderr: "" });
    await expect(checkBinary("yt-dlp", run)).resolves.toEqual({ name: "yt-dlp", available: true });
  });

  it("uses the ffmpeg version flag accepted by ffmpeg", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "version", stderr: "" });
    await checkBinary("ffmpeg", run);
    expect(run).toHaveBeenCalledWith("ffmpeg", ["-version"]);
  });

  it("returns available false when command rejects", async () => {
    const run = vi.fn().mockRejectedValue(new Error("missing"));
    await expect(checkBinary("ffmpeg", run)).resolves.toEqual({
      name: "ffmpeg",
      available: false,
      error: "missing"
    });
  });
});

describe("checkDependencies", () => {
  it("checks yt-dlp and ffmpeg", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "version", stderr: "" });
    const result = await checkDependencies(run);
    expect(result.map((item) => item.name)).toEqual(["yt-dlp", "ffmpeg"]);
  });
});
