import { describe, expect, it, vi } from "vitest";

const { execFile } = vi.hoisted(() => ({
  execFile: vi.fn()
}));

vi.mock("node:child_process", () => ({
  default: {
    execFile
  },
  execFile
}));

vi.mock("./binaries", () => ({
  buildBinaryEnvironment: vi.fn(() => ({ PATH: "/opt/ffmpeg:/usr/bin" })),
  resolveBinaryPath: vi.fn((command: string) => (command === "yt-dlp" ? "/opt/bin/yt-dlp" : command))
}));

import { checkBinary, checkDependencies, defaultCommandRunner } from "./dependencies";

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

describe("defaultCommandRunner", () => {
  it("uses a large stdout buffer for metadata commands", async () => {
    execFile.mockImplementationOnce((_command, _args, _options, callback) => {
      if (typeof _options === "function") {
        _options(null, { stdout: "{}", stderr: "" });
        return;
      }
      callback(null, { stdout: "{}", stderr: "" });
    });

    await expect(defaultCommandRunner("yt-dlp", ["--dump-single-json", "https://youtu.be/id"])).resolves.toEqual({
      stdout: "{}",
      stderr: ""
    });

    expect(execFile).toHaveBeenCalledWith(
      "/opt/bin/yt-dlp",
      ["--dump-single-json", "https://youtu.be/id"],
      expect.objectContaining({
        env: { PATH: "/opt/ffmpeg:/usr/bin" },
        maxBuffer: 25 * 1024 * 1024
      }),
      expect.any(Function)
    );
  });
});
