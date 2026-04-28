import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/download-runner", () => ({
  startDownload: vi.fn()
}));

import { POST } from "./route";

describe("POST /api/downloads", () => {
  it("returns 400 for unsupported URLs", async () => {
    const response = await POST(new Request("http://localhost/api/downloads", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com", formatId: "18" })
    }));

    expect(response.status).toBe(400);
  });

  it("creates a queued job", async () => {
    const response = await POST(new Request("http://localhost/api/downloads", {
      method: "POST",
      body: JSON.stringify({
        url: "https://youtu.be/id",
        formatId: "18",
        title: "Title",
        extension: "mp4"
      })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "queued" });
  });
});
