import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/yt-dlp", () => ({
  fetchVideoInfo: vi.fn().mockResolvedValue({
    video: { id: "id", title: "Title", source: "youtube", durationSeconds: 60 },
    formats: []
  })
}));

import { POST } from "./route";

describe("POST /api/analyze", () => {
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
});
