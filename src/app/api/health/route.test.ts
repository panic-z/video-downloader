import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { checkDependencies } = vi.hoisted(() => ({
  checkDependencies: vi.fn()
}));

vi.mock("@/lib/server/dependencies", () => ({
  checkDependencies
}));

import { GET } from "./route";

describe("GET /api/health", () => {
  const originalVercel = process.env.VERCEL;

  beforeEach(() => {
    checkDependencies.mockResolvedValue([
      { name: "yt-dlp", available: true },
      { name: "ffmpeg", available: true }
    ]);
    delete process.env.VERCEL;
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (originalVercel === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = originalVercel;
    }
  });

  it("reports local mode by default", async () => {
    const response = await GET();

    await expect(response.json()).resolves.toMatchObject({
      mode: "local",
      dependencies: [
        { name: "yt-dlp", available: true },
        { name: "ffmpeg", available: true }
      ]
    });
  });

  it("reports Vercel mode with a local-first warning", async () => {
    process.env.VERCEL = "1";

    const response = await GET();

    await expect(response.json()).resolves.toMatchObject({
      mode: "vercel",
      warning: expect.stringContaining("Run this app locally")
    });
  });
});
