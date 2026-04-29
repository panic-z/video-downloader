import { expect, test } from "@playwright/test";

const videoUrl = "https://www.youtube.com/watch?v=demo";

const analysisResult = {
  video: {
    id: "demo",
    title: "Demo Video",
    source: "youtube",
    durationSeconds: 42
  },
  formats: [
    {
      id: "302",
      downloadSelector: "302",
      label: "1080p mp4 video+audio · 1080P 60 · 60fps · 4200kbps · id 302",
      height: 1080,
      extension: "mp4",
      hasVideo: true,
      hasAudio: true,
      sizeBytes: 44_040_192
    },
    {
      id: "301",
      downloadSelector: "301",
      label: "1080p mp4 video+audio · 1080P · 30fps · 2400kbps · id 301",
      height: 1080,
      extension: "mp4",
      hasVideo: true,
      hasAudio: true,
      sizeBytes: null
    }
  ]
};

async function expectDownloadsBesideFormats(page: import("@playwright/test").Page) {
  const formatsBox = await page
    .locator(".panel")
    .filter({ has: page.getByRole("heading", { name: "Formats" }) })
    .boundingBox();
  const downloadsBox = await page
    .locator(".panel")
    .filter({ has: page.getByRole("heading", { name: "Downloads" }) })
    .boundingBox();

  expect(formatsBox).not.toBeNull();
  expect(downloadsBox).not.toBeNull();
  if (!formatsBox || !downloadsBox) return;

  expect(Math.abs(downloadsBox.y - formatsBox.y)).toBeLessThan(8);
  expect(downloadsBox.x).toBeGreaterThan(formatsBox.x);
}

test("analyzes a URL, displays distinct formats, starts a download, and exposes the file link", async ({
  page
}) => {
  let analyzeRequestBody: unknown;
  let downloadRequestBody: unknown;

  await page.route("**/api/health", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        dependencies: [
          { name: "yt-dlp", available: true },
          { name: "ffmpeg", available: true }
        ]
      })
    });
  });

  await page.route("**/api/analyze", async (route) => {
    analyzeRequestBody = route.request().postDataJSON();
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(analysisResult)
    });
  });

  await page.route("**/api/downloads", async (route) => {
    downloadRequestBody = route.request().postDataJSON();
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ jobId: "job-1", status: "queued" })
    });
  });

  await page.route("**/api/downloads/job-1", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        jobId: "job-1",
        status: "completed",
        progress: 100,
        title: "Demo Video",
        fileName: "demo.mp4",
        error: null
      })
    });
  });

  await page.route("**/api/files/job-1", async (route) => {
    await route.fulfill({
      body: "fake video",
      headers: {
        "content-disposition": 'attachment; filename="demo.mp4"',
        "content-type": "video/mp4"
      }
    });
  });

  await page.goto("/");
  await expectDownloadsBesideFormats(page);
  await page.getByLabel("Video URL").fill(videoUrl);
  await expect(page.getByRole("button", { name: "Analyze" })).toBeEnabled();

  await page.getByRole("button", { name: "Analyze" }).click();

  await expect(page.getByRole("button", { name: "Analyzing..." })).toBeDisabled();
  await expect(page.getByText("Analyzing video and loading formats...")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Demo Video" })).toBeVisible();
  await expect(
    page.getByText("1080p mp4 video+audio · 1080P 60 · 60fps · 4200kbps · id 302")
  ).toBeVisible();
  await expect(
    page.getByText("1080p mp4 video+audio · 1080P · 30fps · 2400kbps · id 301")
  ).toBeVisible();
  expect(analyzeRequestBody).toEqual({ url: videoUrl });

  await page
    .getByLabel("1080p mp4 video+audio · 1080P · 30fps · 2400kbps · id 301")
    .check();
  await page.getByRole("button", { name: "Download selected format" }).click();

  await expect(page.getByRole("button", { name: "Starting download..." })).toBeDisabled();
  await expect(page.getByText("Starting download job...")).toBeVisible();
  await expect(page.getByText("Download job started. Track progress in Downloads.")).toBeVisible();
  await expect(page.getByText("queued · 0%")).toBeVisible();
  await expect(page.getByText("completed · 100%")).toBeVisible();
  expect(downloadRequestBody).toEqual({
    url: videoUrl,
    formatId: "301",
    title: "Demo Video",
    extension: "mp4"
  });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download file" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("demo.mp4");
});

test("shows dependency guidance and keeps analyze disabled when yt-dlp is missing", async ({ page }) => {
  await page.route("**/api/health", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        dependencies: [
          { name: "yt-dlp", available: false, error: "not found" },
          { name: "ffmpeg", available: true }
        ]
      })
    });
  });

  await page.goto("/");
  await page.getByLabel("Video URL").fill(videoUrl);

  await expect(
    page.getByText("Missing dependency: yt-dlp. Install yt-dlp and ffmpeg to enable downloads.")
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Analyze" })).toBeDisabled();
});
