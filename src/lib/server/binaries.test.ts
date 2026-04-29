import { describe, expect, it } from "vitest";
import {
  buildBinaryEnvironment,
  firstExistingPath,
  resolveBinaryPath,
  resolveFfmpegLocation
} from "./binaries";

describe("resolveBinaryPath", () => {
  it("uses packaged yt-dlp and ffmpeg binaries when available", () => {
    expect(resolveBinaryPath("yt-dlp", { ytDlp: "/opt/bin/yt-dlp", ffmpeg: "/opt/bin/ffmpeg" })).toBe(
      "/opt/bin/yt-dlp"
    );
    expect(resolveBinaryPath("ffmpeg", { ytDlp: "/opt/bin/yt-dlp", ffmpeg: "/opt/bin/ffmpeg" })).toBe(
      "/opt/bin/ffmpeg"
    );
  });

  it("falls back to system command names when packaged binaries are unavailable", () => {
    expect(resolveBinaryPath("yt-dlp", { ytDlp: null, ffmpeg: null })).toBe("yt-dlp");
    expect(resolveBinaryPath("ffmpeg", { ytDlp: null, ffmpeg: null })).toBe("ffmpeg");
  });
});

describe("firstExistingPath", () => {
  it("selects the first path that exists", () => {
    const exists = (candidate: string) => candidate === "/var/task/node_modules/youtube-dl-exec/bin/yt-dlp_linux";

    expect(
      firstExistingPath(
        [
          "/ROOT/node_modules/youtube-dl-exec/bin/yt-dlp",
          "/var/task/node_modules/youtube-dl-exec/bin/yt-dlp_linux"
        ],
        exists
      )
    ).toBe("/var/task/node_modules/youtube-dl-exec/bin/yt-dlp_linux");
  });

  it("returns null when no candidates exist", () => {
    expect(firstExistingPath(["/ROOT/bin/yt-dlp", "/var/task/bin/yt-dlp"], () => false)).toBeNull();
  });
});

describe("buildBinaryEnvironment", () => {
  it("prepends the packaged ffmpeg directory to PATH", () => {
    const env = buildBinaryEnvironment(
      { NODE_ENV: "test", PATH: "/usr/bin" },
      { ytDlp: "/opt/bin/yt-dlp", ffmpeg: "/opt/ffmpeg/ffmpeg" }
    );

    expect(env.PATH).toBe("/opt/ffmpeg:/usr/bin");
  });
});

describe("resolveFfmpegLocation", () => {
  it("returns the packaged ffmpeg binary path for yt-dlp merge operations", () => {
    expect(resolveFfmpegLocation({ ytDlp: "/opt/bin/yt-dlp", ffmpeg: "/opt/ffmpeg/ffmpeg" })).toBe(
      "/opt/ffmpeg/ffmpeg"
    );
  });
});
