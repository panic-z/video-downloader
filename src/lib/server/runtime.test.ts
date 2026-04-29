import path from "node:path";
import { describe, expect, it } from "vitest";
import { getDownloadDir, getRuntimeMode, localFirstWarning } from "./runtime";

describe("getRuntimeMode", () => {
  it("returns local when Vercel is not set", () => {
    expect(getRuntimeMode({})).toBe("local");
  });

  it("returns vercel when VERCEL is set", () => {
    expect(getRuntimeMode({ VERCEL: "1" })).toBe("vercel");
  });
});

describe("getDownloadDir", () => {
  it("uses the project downloads directory in local mode", () => {
    expect(getDownloadDir({}, "/repo", "/tmp")).toBe(path.join("/repo", "downloads"));
  });

  it("uses a temporary directory in Vercel mode", () => {
    expect(getDownloadDir({ VERCEL: "1" }, "/repo", "/tmp")).toBe(
      path.join("/tmp", "video-downloader-downloads")
    );
  });
});

describe("localFirstWarning", () => {
  it("tells users to run the downloader locally", () => {
    expect(localFirstWarning).toContain("Run this app locally");
  });
});
