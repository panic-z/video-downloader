import { describe, expect, it } from "vitest";
import { detectVideoSource, parseSupportedVideoUrl } from "./url";

describe("parseSupportedVideoUrl", () => {
  it("accepts YouTube watch URLs", () => {
    const result = parseSupportedVideoUrl("https://www.youtube.com/watch?v=abc123");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.source).toBe("youtube");
  });

  it("accepts Bilibili video URLs", () => {
    const result = parseSupportedVideoUrl("https://www.bilibili.com/video/BV1xx411c7mD");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.source).toBe("bilibili");
  });

  it("rejects unsupported hosts", () => {
    expect(parseSupportedVideoUrl("https://example.com/video").ok).toBe(false);
  });

  it("rejects invalid URL text", () => {
    expect(parseSupportedVideoUrl("not a url").ok).toBe(false);
  });
});

describe("detectVideoSource", () => {
  it("detects youtu.be short URLs", () => {
    expect(detectVideoSource(new URL("https://youtu.be/abc123"))).toBe("youtube");
  });

  it("detects b23.tv short URLs as bilibili", () => {
    expect(detectVideoSource(new URL("https://b23.tv/abc123"))).toBe("bilibili");
  });
});
