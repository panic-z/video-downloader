import { describe, expect, it } from "vitest";
import { normalizeYtDlpInfo } from "./formats";

const sample = {
  id: "abc123",
  title: "Sample Video",
  webpage_url: "https://www.youtube.com/watch?v=abc123",
  duration: 90,
  formats: [
    {
      format_id: "18",
      ext: "mp4",
      height: 360,
      vcodec: "avc1",
      acodec: "mp4a",
      filesize: 1000
    },
    {
      format_id: "137",
      ext: "mp4",
      height: 1080,
      vcodec: "avc1",
      acodec: "none",
      filesize_approx: 2000
    },
    {
      format_id: "140",
      ext: "m4a",
      height: null,
      vcodec: "none",
      acodec: "mp4a"
    }
  ]
};

describe("normalizeYtDlpInfo", () => {
  it("normalizes metadata and formats", () => {
    const result = normalizeYtDlpInfo(sample);
    expect(result.video).toEqual({
      id: "abc123",
      title: "Sample Video",
      source: "youtube",
      durationSeconds: 90
    });
    expect(result.formats[0]).toMatchObject({
      id: "137",
      downloadSelector: "137+bestaudio/best",
      label: "1080p mp4 video+audio",
      height: 1080,
      extension: "mp4",
      hasVideo: true,
      hasAudio: false,
      sizeBytes: 2000
    });
  });

  it("prefers higher video formats before lower formats", () => {
    const result = normalizeYtDlpInfo(sample);
    expect(result.formats.map((format) => format.id)).toEqual(["137", "18", "140"]);
  });

  it("keeps radio ids separate from yt-dlp download selectors", () => {
    const result = normalizeYtDlpInfo(sample);

    expect(
      result.formats.map((format) => ({
        id: format.id,
        downloadSelector: format.downloadSelector
      }))
    ).toEqual([
      { id: "137", downloadSelector: "137+bestaudio/best" },
      { id: "18", downloadSelector: "18" },
      { id: "140", downloadSelector: "140" }
    ]);
  });

  it("handles malformed top-level input and skips malformed format entries", () => {
    expect(normalizeYtDlpInfo(null)).toEqual({
      video: {
        id: "unknown",
        title: "Untitled video",
        source: "other",
        durationSeconds: null
      },
      formats: []
    });
    expect(normalizeYtDlpInfo([])).toEqual({
      video: {
        id: "unknown",
        title: "Untitled video",
        source: "other",
        durationSeconds: null
      },
      formats: []
    });

    const result = normalizeYtDlpInfo({
      formats: [
        null,
        "bad",
        {
          format_id: "22",
          ext: "mp4",
          height: 720,
          vcodec: "avc1",
          acodec: "mp4a"
        }
      ]
    });

    expect(result.formats.map((format) => format.id)).toEqual(["22"]);
  });

  it("does not label video formats with missing height as audio", () => {
    const result = normalizeYtDlpInfo({
      formats: [
        {
          format_id: "video-no-height",
          ext: "mp4",
          vcodec: "avc1",
          acodec: "none"
        }
      ]
    });

    expect(result.formats[0]).toMatchObject({
      id: "video-no-height",
      label: "unknown mp4 video+audio",
      hasVideo: true,
      hasAudio: false,
      height: null
    });
  });

  it("adds enough detail to distinguish formats with the same quality and container", () => {
    const result = normalizeYtDlpInfo({
      formats: [
        {
          format_id: "301",
          ext: "mp4",
          height: 1080,
          format_note: "1080P",
          fps: 30,
          tbr: 2400,
          vcodec: "avc1",
          acodec: "mp4a"
        },
        {
          format_id: "302",
          ext: "mp4",
          height: 1080,
          format_note: "1080P 60",
          fps: 60,
          tbr: 4200,
          vcodec: "avc1",
          acodec: "mp4a"
        }
      ]
    });

    expect(result.formats.map((format) => ({
      id: format.id,
      label: format.label
    }))).toEqual([
      {
        id: "302",
        label: "1080p 60fps mp4 video+audio"
      }
    ]);
  });

  it("uses the display quality instead of landscape width for Bilibili-style formats", () => {
    const result = normalizeYtDlpInfo({
      formats: [
        {
          format_id: "137",
          ext: "mp4",
          height: 1920,
          width: 1080,
          format_note: "1080p",
          fps: 30,
          tbr: 1974,
          vcodec: "avc1",
          acodec: "none",
          filesize: 15_728_640
        }
      ]
    });

    expect(result.formats[0]).toMatchObject({
      id: "137",
      height: 1080,
      label: "1080p mp4 video+audio"
    });
  });

  it("keeps one recommended video option per display quality", () => {
    const result = normalizeYtDlpInfo({
      formats: [
        {
          format_id: "137",
          ext: "mp4",
          height: 1920,
          width: 1080,
          format_note: "1080p",
          fps: 30,
          tbr: 1974,
          vcodec: "avc1",
          acodec: "none",
          filesize: 15_728_640
        },
        {
          format_id: "399",
          ext: "mp4",
          height: 1920,
          width: 1080,
          format_note: "1080p",
          fps: 30,
          tbr: 1342,
          vcodec: "av01",
          acodec: "none",
          filesize: 10_485_760
        },
        {
          format_id: "248",
          ext: "webm",
          height: 1920,
          width: 1080,
          format_note: "1080p",
          vcodec: "vp9",
          acodec: "none",
          filesize: 12_582_912
        },
        {
          format_id: "22",
          ext: "mp4",
          height: 1280,
          width: 720,
          format_note: "720p",
          vcodec: "avc1",
          acodec: "mp4a"
        },
        {
          format_id: "136",
          ext: "mp4",
          height: 1280,
          width: 720,
          format_note: "720p",
          fps: 30,
          tbr: 932,
          vcodec: "avc1",
          acodec: "none",
          filesize: 7_340_032
        }
      ]
    });

    expect(result.formats.map((format) => ({
      id: format.id,
      label: format.label,
      downloadSelector: format.downloadSelector
    }))).toEqual([
      {
        id: "137",
        label: "1080p mp4 video+audio",
        downloadSelector: "137+bestaudio/best"
      },
      {
        id: "136",
        label: "720p mp4 video+audio",
        downloadSelector: "136+bestaudio/best"
      }
    ]);
  });

  it("does not prefer unknown-size combined streams over concrete video streams", () => {
    const result = normalizeYtDlpInfo({
      formats: [
        {
          format_id: "combined-1080",
          ext: "mp4",
          height: 1920,
          width: 1080,
          format_note: "1080p",
          vcodec: "avc1",
          acodec: "mp4a"
        },
        {
          format_id: "137",
          ext: "mp4",
          height: 1920,
          width: 1080,
          format_note: "1080p",
          fps: 30,
          tbr: 1974,
          vcodec: "avc1",
          acodec: "none",
          filesize: 15_728_640
        }
      ]
    });

    expect(result.formats.map((format) => ({
      id: format.id,
      downloadSelector: format.downloadSelector
    }))).toEqual([
      {
        id: "137",
        downloadSelector: "137+bestaudio/best"
      }
    ]);
  });

  it("skips formats without identifiable video or audio codecs", () => {
    const result = normalizeYtDlpInfo({
      formats: [
        {
          format_id: "unknown-media",
          ext: "mp4"
        },
        {
          format_id: "valid-audio",
          ext: "m4a",
          vcodec: "none",
          acodec: "mp4a"
        }
      ]
    });

    expect(result.formats.map((format) => format.id)).toEqual(["valid-audio"]);
  });
});
