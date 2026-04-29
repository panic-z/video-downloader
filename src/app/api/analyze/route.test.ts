import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchVideoInfo } = vi.hoisted(() => ({
  fetchVideoInfo: vi.fn()
}));

vi.mock("@/lib/server/yt-dlp", () => ({ fetchVideoInfo }));

import { POST } from "./route";

describe("POST /api/analyze", () => {
  const originalVercel = process.env.VERCEL;

  beforeEach(() => {
    fetchVideoInfo.mockResolvedValue({
      video: { id: "id", title: "Title", source: "youtube", durationSeconds: 60 },
      formats: []
    });
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

  it("returns 400 for unsupported URLs", async () => {
    const response = await POST(new Request("http://localhost/api/analyze", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com" })
    }));

    expect(response.status).toBe(400);
  });

  it("returns analyzed video info", async () => {
    const response = await POST(new Request("http://localhost/api/analyze", {
      method: "POST",
      body: JSON.stringify({ url: "https://youtu.be/id" })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ video: { title: "Title" } });
  });

  it("returns a local-first error on Vercel", async () => {
    process.env.VERCEL = "1";

    const response = await POST(new Request("http://localhost/api/analyze", {
      method: "POST",
      body: JSON.stringify({ url: "https://youtu.be/id" })
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: expect.stringContaining("Run this app locally")
    });
    expect(fetchVideoInfo).not.toHaveBeenCalled();
  });
});
