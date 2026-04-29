import { normalizeYtDlpInfo } from "@/lib/video/formats";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDownloadArgs, fetchVideoInfo } from "./yt-dlp";

vi.mock("@/lib/video/formats", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/video/formats")>();
  return {
    ...actual,
    normalizeYtDlpInfo: vi.fn(actual.normalizeYtDlpInfo)
  };
});

afterEach(() => {
  vi.mocked(normalizeYtDlpInfo).mockClear();
});

describe("fetchVideoInfo", () => {
  it("calls yt-dlp with JSON metadata arguments", async () => {
    const run = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({
        id: "id",
        title: "Title",
        webpage_url: "https://youtu.be/id",
        formats: []
      }),
      stderr: ""
    });

    await expect(fetchVideoInfo("https://youtu.be/id", run)).resolves.toMatchObject({
      video: { id: "id", title: "Title" }
    });
    expect(run).toHaveBeenCalledWith("yt-dlp", ["--dump-single-json", "--no-playlist", "https://youtu.be/id"]);
  });

  it("throws a readable error for invalid JSON", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "not json", stderr: "" });
    await expect(fetchVideoInfo("https://youtu.be/id", run)).rejects.toThrow("yt-dlp returned invalid JSON");
  });

  it("does not relabel normalization errors as invalid JSON", async () => {
    vi.mocked(normalizeYtDlpInfo).mockImplementationOnce(() => {
      throw new SyntaxError("normalization syntax error");
    });
    const run = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({
        id: "id",
        title: "Title",
        webpage_url: "https://youtu.be/id",
        formats: []
      }),
      stderr: ""
    });

    const result = fetchVideoInfo("https://youtu.be/id", run);
    await expect(result).rejects.toThrow("normalization syntax error");
    await expect(result).rejects.not.toThrow("yt-dlp returned invalid JSON");
  });
});

describe("buildDownloadArgs", () => {
  it("builds deterministic download arguments", () => {
    expect(
      buildDownloadArgs({
        url: "https://youtu.be/id",
        formatId: "18",
        outputTemplate: "downloads/file.%(ext)s",
        ffmpegLocation: "/opt/ffmpeg/ffmpeg"
      })
    ).toEqual([
      "--newline",
      "--no-playlist",
      "-f",
      "18",
      "--ffmpeg-location",
      "/opt/ffmpeg/ffmpeg",
      "--merge-output-format",
      "mp4",
      "-o",
      "downloads/file.%(ext)s",
      "https://youtu.be/id"
    ]);
  });
});
