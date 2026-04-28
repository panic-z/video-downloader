# Video Downloader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only Next.js video downloader for public Bilibili and YouTube URLs with format analysis, server-side downloads, progress polling, and completed file downloads.

**Architecture:** Use a Next.js App Router application with thin API routes and focused server modules for validation, `yt-dlp` integration, job state, dependency checks, and file serving. Keep automated tests offline by mocking process execution and filesystem boundaries. Store completed files under project-root `downloads/` and keep job state in memory for version one.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Testing Library, `yt-dlp`, `ffmpeg`, Node.js child process APIs.

---

## File Structure

- Create: `package.json` - npm scripts, dependencies, and dev dependencies.
- Create: `tsconfig.json` - strict TypeScript config.
- Create: `next.config.ts` - minimal Next.js config.
- Create: `vitest.config.ts` - Vitest config for Node and React tests.
- Create: `src/test/setup.ts` - Testing Library setup.
- Create: `src/app/layout.tsx` - root HTML shell.
- Create: `src/app/page.tsx` - main downloader UI.
- Create: `src/app/page.test.tsx` - home page smoke test.
- Create: `src/app/globals.css` - application styling.
- Create: `src/app/api/health/route.ts` - dependency health endpoint.
- Create: `src/app/api/analyze/route.ts` - analyze API route.
- Create: `src/app/api/downloads/route.ts` - create download job API route.
- Create: `src/app/api/downloads/[id]/route.ts` - job status API route.
- Create: `src/app/api/files/[id]/route.ts` - completed file download API route.
- Create: `src/lib/video/types.ts` - shared video, format, and job types.
- Create: `src/lib/video/url.ts` - URL validation and source detection.
- Create: `src/lib/video/formats.ts` - `yt-dlp` JSON normalization and labels.
- Create: `src/lib/video/progress.ts` - download progress parser.
- Create: `src/lib/video/filenames.ts` - safe filename helpers.
- Create: `src/lib/server/dependencies.ts` - `yt-dlp` and `ffmpeg` availability checks.
- Create: `src/lib/server/yt-dlp.ts` - command argument building and process wrappers.
- Create: `src/lib/server/job-store.ts` - in-memory job store.
- Create: `src/lib/server/download-runner.ts` - background download orchestration.
- Create: `src/lib/server/files.ts` - safe completed-file lookup.
- Create: `src/lib/server/api-errors.ts` - structured API error helpers.
- Create: `src/lib/video/*.test.ts` - unit tests for pure video helpers.
- Create: `src/lib/server/*.test.ts` - unit tests for server helpers with mocked process/filesystem boundaries.
- Create: `src/app/api/**/*.test.ts` - API route tests with mocked server modules.

## Task 1: Scaffold the Next.js and Test Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/page.test.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Create project config files**

Create `package.json`:

```json
{
  "name": "video-downloader",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "latest",
    "react": "latest",
    "react-dom": "latest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "jsdom": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"]
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and npm exits successfully.

- [ ] **Step 3: Create the minimal app shell**

Create `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video Downloader",
  description: "Local Bilibili and YouTube video downloader"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Create `src/app/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main className="shell">
      <section className="panel">
        <h1>Video Downloader</h1>
        <p className="muted">Paste a public Bilibili or YouTube URL to inspect formats.</p>
      </section>
    </main>
  );
}
```

Create `src/app/globals.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #f5f7fb;
  color: #172033;
  font-family: Arial, Helvetica, sans-serif;
}

button,
input,
select {
  font: inherit;
}

.shell {
  min-height: 100vh;
  padding: 32px;
}

.panel {
  max-width: 1120px;
  margin: 0 auto;
  background: #ffffff;
  border: 1px solid #dce3ee;
  border-radius: 8px;
  padding: 24px;
}

.muted {
  color: #647087;
}
```

- [ ] **Step 4: Write a scaffold smoke test**

Create `src/app/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("renders the initial product heading", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Video Downloader" })).toBeInTheDocument();
    expect(screen.getByText("Paste a public Bilibili or YouTube URL to inspect formats.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Verify scaffold**

Run: `npm run test -- src/app/page.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: Next.js builds successfully.

- [ ] **Step 6: Commit scaffold**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts vitest.config.ts src/test/setup.ts src/app/layout.tsx src/app/page.tsx src/app/page.test.tsx src/app/globals.css
git commit -m "chore: scaffold next app"
```

## Task 2: Add Shared Types, URL Validation, Filename Helpers, and Progress Parsing

**Files:**
- Create: `src/lib/video/types.ts`
- Create: `src/lib/video/url.ts`
- Create: `src/lib/video/url.test.ts`
- Create: `src/lib/video/filenames.ts`
- Create: `src/lib/video/filenames.test.ts`
- Create: `src/lib/video/progress.ts`
- Create: `src/lib/video/progress.test.ts`

- [ ] **Step 1: Write failing URL validation tests**

Create `src/lib/video/url.test.ts`:

```ts
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
```

- [ ] **Step 2: Run URL tests to verify they fail**

Run: `npm run test -- src/lib/video/url.test.ts`

Expected: FAIL because `src/lib/video/url.ts` does not exist.

- [ ] **Step 3: Implement shared types and URL validation**

Create `src/lib/video/types.ts`:

```ts
export type VideoSource = "youtube" | "bilibili" | "other";

export type VideoFormat = {
  id: string;
  label: string;
  height: number | null;
  extension: string | null;
  hasVideo: boolean;
  hasAudio: boolean;
  sizeBytes: number | null;
};

export type VideoInfo = {
  id: string;
  title: string;
  source: VideoSource;
  durationSeconds: number | null;
};

export type AnalyzeResult = {
  video: VideoInfo;
  formats: VideoFormat[];
};

export type DownloadJobStatus = "queued" | "running" | "completed" | "failed";

export type DownloadJob = {
  jobId: string;
  status: DownloadJobStatus;
  progress: number;
  title: string;
  fileName: string | null;
  filePath: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
};
```

Create `src/lib/video/url.ts`:

```ts
import type { VideoSource } from "./types";

type ParsedUrlResult =
  | { ok: true; url: string; source: VideoSource }
  | { ok: false; error: string };

export function detectVideoSource(url: URL): VideoSource {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
    return "youtube";
  }

  if (host === "bilibili.com" || host.endsWith(".bilibili.com") || host === "b23.tv") {
    return "bilibili";
  }

  return "other";
}

export function parseSupportedVideoUrl(value: string): ParsedUrlResult {
  let parsed: URL;

  try {
    parsed = new URL(value.trim());
  } catch {
    return { ok: false, error: "Enter a valid URL." };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Only http and https URLs are supported." };
  }

  const source = detectVideoSource(parsed);
  if (source !== "youtube" && source !== "bilibili") {
    return { ok: false, error: "Only public Bilibili and YouTube URLs are supported." };
  }

  return { ok: true, url: parsed.toString(), source };
}
```

- [ ] **Step 4: Verify URL tests pass**

Run: `npm run test -- src/lib/video/url.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing filename helper tests**

Create `src/lib/video/filenames.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildDownloadFileName, sanitizeFileName } from "./filenames";

describe("sanitizeFileName", () => {
  it("removes filesystem-hostile characters", () => {
    expect(sanitizeFileName('A/B:C*D?"E<F>|G')).toBe("A_B_C_D__E_F__G");
  });

  it("falls back when the title is empty after trimming", () => {
    expect(sanitizeFileName("   ")).toBe("video");
  });
});

describe("buildDownloadFileName", () => {
  it("includes a short job suffix and extension", () => {
    expect(buildDownloadFileName("My Video", "job-abcdef123456", "mp4")).toBe("My Video-job-abcdef12.mp4");
  });
});
```

- [ ] **Step 6: Run filename tests to verify they fail**

Run: `npm run test -- src/lib/video/filenames.test.ts`

Expected: FAIL because `src/lib/video/filenames.ts` does not exist.

- [ ] **Step 7: Implement filename helpers**

Create `src/lib/video/filenames.ts`:

```ts
const RESERVED_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

export function sanitizeFileName(title: string): string {
  const cleaned = title.trim().replace(RESERVED_CHARS, "_").replace(/\s+/g, " ");
  return cleaned.length > 0 ? cleaned.slice(0, 120) : "video";
}

export function buildDownloadFileName(title: string, jobId: string, extension: string | null): string {
  const safeTitle = sanitizeFileName(title);
  const suffix = jobId.slice(0, 12);
  const safeExt = extension?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "mp4";
  return `${safeTitle}-${suffix}.${safeExt}`;
}
```

- [ ] **Step 8: Verify filename tests pass**

Run: `npm run test -- src/lib/video/filenames.test.ts`

Expected: PASS.

- [ ] **Step 9: Write failing progress parser tests**

Create `src/lib/video/progress.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseDownloadProgress } from "./progress";

describe("parseDownloadProgress", () => {
  it("parses yt-dlp percentage output", () => {
    expect(parseDownloadProgress("[download]  62.3% of 10.00MiB at 1.00MiB/s ETA 00:04")).toBe(62.3);
  });

  it("rounds completed output to 100", () => {
    expect(parseDownloadProgress("[download] 100% of 10.00MiB in 00:10")).toBe(100);
  });

  it("returns null when no percentage is present", () => {
    expect(parseDownloadProgress("Deleting original file")).toBeNull();
  });
});
```

- [ ] **Step 10: Run progress tests to verify they fail**

Run: `npm run test -- src/lib/video/progress.test.ts`

Expected: FAIL because `src/lib/video/progress.ts` does not exist.

- [ ] **Step 11: Implement progress parser**

Create `src/lib/video/progress.ts`:

```ts
export function parseDownloadProgress(line: string): number | null {
  const match = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
  if (!match) return null;

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, parsed));
}
```

- [ ] **Step 12: Verify pure helper tests pass**

Run: `npm run test -- src/lib/video/url.test.ts src/lib/video/filenames.test.ts src/lib/video/progress.test.ts`

Expected: PASS.

- [ ] **Step 13: Commit helper modules**

```bash
git add src/lib/video
git commit -m "feat: add video helper modules"
```

## Task 3: Normalize yt-dlp Metadata and Formats

**Files:**
- Create: `src/lib/video/formats.ts`
- Create: `src/lib/video/formats.test.ts`

- [ ] **Step 1: Write failing normalization tests**

Create `src/lib/video/formats.test.ts`:

```ts
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
      label: "1080p mp4 video",
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
});
```

- [ ] **Step 2: Run normalization tests to verify they fail**

Run: `npm run test -- src/lib/video/formats.test.ts`

Expected: FAIL because `src/lib/video/formats.ts` does not exist.

- [ ] **Step 3: Implement format normalization**

Create `src/lib/video/formats.ts`:

```ts
import { detectVideoSource } from "./url";
import type { AnalyzeResult, VideoFormat, VideoSource } from "./types";

type RawFormat = {
  format_id?: unknown;
  ext?: unknown;
  height?: unknown;
  vcodec?: unknown;
  acodec?: unknown;
  filesize?: unknown;
  filesize_approx?: unknown;
};

type RawInfo = {
  id?: unknown;
  title?: unknown;
  webpage_url?: unknown;
  duration?: unknown;
  formats?: unknown;
};

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sourceFromWebpageUrl(value: unknown): VideoSource {
  if (typeof value !== "string") return "other";
  try {
    return detectVideoSource(new URL(value));
  } catch {
    return "other";
  }
}

function labelFor(format: Omit<VideoFormat, "label">): string {
  const quality = format.height ? `${format.height}p` : "audio";
  const ext = format.extension ?? "unknown";
  const media =
    format.hasVideo && format.hasAudio ? "video+audio" : format.hasVideo ? "video" : "audio";
  return `${quality} ${ext} ${media}`;
}

function normalizeFormat(raw: RawFormat): VideoFormat | null {
  const id = text(raw.format_id, "");
  if (!id) return null;

  const extension = typeof raw.ext === "string" ? raw.ext : null;
  const height = numberOrNull(raw.height);
  const hasVideo = typeof raw.vcodec === "string" && raw.vcodec !== "none";
  const hasAudio = typeof raw.acodec === "string" && raw.acodec !== "none";
  const sizeBytes = numberOrNull(raw.filesize) ?? numberOrNull(raw.filesize_approx);

  const normalized = { id, height, extension, hasVideo, hasAudio, sizeBytes };
  return { ...normalized, label: labelFor(normalized) };
}

export function normalizeYtDlpInfo(rawInfo: RawInfo): AnalyzeResult {
  const rawFormats = Array.isArray(rawInfo.formats) ? rawInfo.formats : [];
  const formats = rawFormats
    .map((raw) => normalizeFormat(raw as RawFormat))
    .filter((format): format is VideoFormat => Boolean(format))
    .sort((a, b) => {
      const videoDelta = Number(b.hasVideo) - Number(a.hasVideo);
      if (videoDelta !== 0) return videoDelta;
      return (b.height ?? 0) - (a.height ?? 0);
    });

  return {
    video: {
      id: text(rawInfo.id, "unknown"),
      title: text(rawInfo.title, "Untitled video"),
      source: sourceFromWebpageUrl(rawInfo.webpage_url),
      durationSeconds: numberOrNull(rawInfo.duration)
    },
    formats
  };
}
```

- [ ] **Step 4: Verify normalization tests pass**

Run: `npm run test -- src/lib/video/formats.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit format normalization**

```bash
git add src/lib/video/formats.ts src/lib/video/formats.test.ts
git commit -m "feat: normalize yt-dlp formats"
```

## Task 4: Add Dependency Checks and yt-dlp Command Builders

**Files:**
- Create: `src/lib/server/dependencies.ts`
- Create: `src/lib/server/dependencies.test.ts`
- Create: `src/lib/server/yt-dlp.ts`
- Create: `src/lib/server/yt-dlp.test.ts`

- [ ] **Step 1: Write failing dependency tests**

Create `src/lib/server/dependencies.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { checkBinary, checkDependencies } from "./dependencies";

describe("checkBinary", () => {
  it("returns available true when command exits successfully", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "version", stderr: "" });
    await expect(checkBinary("yt-dlp", run)).resolves.toEqual({ name: "yt-dlp", available: true });
  });

  it("returns available false when command rejects", async () => {
    const run = vi.fn().mockRejectedValue(new Error("missing"));
    await expect(checkBinary("ffmpeg", run)).resolves.toEqual({
      name: "ffmpeg",
      available: false,
      error: "missing"
    });
  });
});

describe("checkDependencies", () => {
  it("checks yt-dlp and ffmpeg", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "version", stderr: "" });
    const result = await checkDependencies(run);
    expect(result.map((item) => item.name)).toEqual(["yt-dlp", "ffmpeg"]);
  });
});
```

- [ ] **Step 2: Run dependency tests to verify they fail**

Run: `npm run test -- src/lib/server/dependencies.test.ts`

Expected: FAIL because `src/lib/server/dependencies.ts` does not exist.

- [ ] **Step 3: Implement dependency checks**

Create `src/lib/server/dependencies.ts`:

```ts
import { promisify } from "node:util";
import { execFile } from "node:child_process";

export type BinaryCheck = {
  name: "yt-dlp" | "ffmpeg";
  available: boolean;
  error?: string;
};

export type CommandRunner = (
  command: string,
  args: string[]
) => Promise<{ stdout: string; stderr: string }>;

const execFileAsync = promisify(execFile);

export const defaultCommandRunner: CommandRunner = async (command, args) => {
  const { stdout, stderr } = await execFileAsync(command, args);
  return { stdout, stderr };
};

export async function checkBinary(
  name: BinaryCheck["name"],
  run: CommandRunner = defaultCommandRunner
): Promise<BinaryCheck> {
  try {
    await run(name, ["--version"]);
    return { name, available: true };
  } catch (error) {
    return {
      name,
      available: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function checkDependencies(run: CommandRunner = defaultCommandRunner): Promise<BinaryCheck[]> {
  return Promise.all([checkBinary("yt-dlp", run), checkBinary("ffmpeg", run)]);
}
```

- [ ] **Step 4: Verify dependency tests pass**

Run: `npm run test -- src/lib/server/dependencies.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing yt-dlp wrapper tests**

Create `src/lib/server/yt-dlp.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { buildDownloadArgs, fetchVideoInfo } from "./yt-dlp";

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
});

describe("buildDownloadArgs", () => {
  it("builds deterministic download arguments", () => {
    expect(
      buildDownloadArgs({
        url: "https://youtu.be/id",
        formatId: "18",
        outputTemplate: "downloads/file.%(ext)s"
      })
    ).toEqual([
      "--newline",
      "--no-playlist",
      "-f",
      "18",
      "--merge-output-format",
      "mp4",
      "-o",
      "downloads/file.%(ext)s",
      "https://youtu.be/id"
    ]);
  });
});
```

- [ ] **Step 6: Run yt-dlp wrapper tests to verify they fail**

Run: `npm run test -- src/lib/server/yt-dlp.test.ts`

Expected: FAIL because `src/lib/server/yt-dlp.ts` does not exist.

- [ ] **Step 7: Implement yt-dlp wrapper**

Create `src/lib/server/yt-dlp.ts`:

```ts
import { normalizeYtDlpInfo } from "@/lib/video/formats";
import type { AnalyzeResult } from "@/lib/video/types";
import { defaultCommandRunner, type CommandRunner } from "./dependencies";

export async function fetchVideoInfo(
  url: string,
  run: CommandRunner = defaultCommandRunner
): Promise<AnalyzeResult> {
  const { stdout } = await run("yt-dlp", ["--dump-single-json", "--no-playlist", url]);

  try {
    return normalizeYtDlpInfo(JSON.parse(stdout));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("yt-dlp returned invalid JSON");
    }
    throw error;
  }
}

export function buildDownloadArgs(input: {
  url: string;
  formatId: string;
  outputTemplate: string;
}): string[] {
  return [
    "--newline",
    "--no-playlist",
    "-f",
    input.formatId,
    "--merge-output-format",
    "mp4",
    "-o",
    input.outputTemplate,
    input.url
  ];
}
```

- [ ] **Step 8: Verify server wrapper tests pass**

Run: `npm run test -- src/lib/server/dependencies.test.ts src/lib/server/yt-dlp.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit dependency and yt-dlp wrappers**

```bash
git add src/lib/server/dependencies.ts src/lib/server/dependencies.test.ts src/lib/server/yt-dlp.ts src/lib/server/yt-dlp.test.ts
git commit -m "feat: add yt-dlp server helpers"
```

## Task 5: Add Job Store, Download Runner, and File Lookup

**Files:**
- Create: `src/lib/server/job-store.ts`
- Create: `src/lib/server/job-store.test.ts`
- Create: `src/lib/server/download-runner.ts`
- Create: `src/lib/server/download-runner.test.ts`
- Create: `src/lib/server/files.ts`
- Create: `src/lib/server/files.test.ts`

- [ ] **Step 1: Write failing job store tests**

Create `src/lib/server/job-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createJobStore } from "./job-store";

describe("createJobStore", () => {
  it("creates and reads queued jobs", () => {
    const store = createJobStore(() => 1000);
    const job = store.create({ title: "Title" });
    expect(job.status).toBe("queued");
    expect(store.get(job.jobId)).toEqual(job);
  });

  it("updates jobs immutably", () => {
    const store = createJobStore(() => 1000);
    const job = store.create({ title: "Title" });
    const updated = store.update(job.jobId, { status: "running", progress: 25 });
    expect(updated?.status).toBe("running");
    expect(updated?.progress).toBe(25);
  });
});
```

- [ ] **Step 2: Run job store tests to verify they fail**

Run: `npm run test -- src/lib/server/job-store.test.ts`

Expected: FAIL because `src/lib/server/job-store.ts` does not exist.

- [ ] **Step 3: Implement job store**

Create `src/lib/server/job-store.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { DownloadJob } from "@/lib/video/types";

export function createJobStore(now: () => number = Date.now) {
  const jobs = new Map<string, DownloadJob>();

  return {
    create(input: { title: string }): DownloadJob {
      const timestamp = now();
      const job: DownloadJob = {
        jobId: `job-${randomUUID()}`,
        status: "queued",
        progress: 0,
        title: input.title,
        fileName: null,
        filePath: null,
        error: null,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      jobs.set(job.jobId, job);
      return job;
    },
    get(jobId: string): DownloadJob | null {
      return jobs.get(jobId) ?? null;
    },
    update(jobId: string, patch: Partial<DownloadJob>): DownloadJob | null {
      const current = jobs.get(jobId);
      if (!current) return null;
      const updated = { ...current, ...patch, updatedAt: now() };
      jobs.set(jobId, updated);
      return updated;
    }
  };
}

export const jobStore = createJobStore();
```

- [ ] **Step 4: Verify job store tests pass**

Run: `npm run test -- src/lib/server/job-store.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing download runner tests**

Create `src/lib/server/download-runner.test.ts`:

```ts
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { startDownload } from "./download-runner";
import { createJobStore } from "./job-store";

function childProcessMock() {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  return proc;
}

describe("startDownload", () => {
  it("marks a job completed when the child exits successfully", async () => {
    const store = createJobStore(() => 1000);
    const job = store.create({ title: "Title" });
    const proc = childProcessMock();
    const spawn = vi.fn().mockReturnValue(proc);

    startDownload({
      job,
      url: "https://youtu.be/id",
      formatId: "18",
      extension: "mp4",
      downloadDir: "/tmp/downloads",
      store,
      spawn
    });

    proc.stdout.emit("data", Buffer.from("[download]  50.0% of 10MiB\n"));
    proc.emit("close", 0);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.get(job.jobId)).toMatchObject({ status: "completed", progress: 100 });
  });

  it("marks a job failed when the child exits with an error", async () => {
    const store = createJobStore(() => 1000);
    const job = store.create({ title: "Title" });
    const proc = childProcessMock();
    const spawn = vi.fn().mockReturnValue(proc);

    startDownload({
      job,
      url: "https://youtu.be/id",
      formatId: "18",
      extension: "mp4",
      downloadDir: "/tmp/downloads",
      store,
      spawn
    });

    proc.stderr.emit("data", Buffer.from("format unavailable"));
    proc.emit("close", 1);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.get(job.jobId)).toMatchObject({ status: "failed", error: "format unavailable" });
  });
});
```

- [ ] **Step 6: Run download runner tests to verify they fail**

Run: `npm run test -- src/lib/server/download-runner.test.ts`

Expected: FAIL because `src/lib/server/download-runner.ts` does not exist.

- [ ] **Step 7: Implement download runner**

Create `src/lib/server/download-runner.ts`:

```ts
import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { buildDownloadFileName } from "@/lib/video/filenames";
import { parseDownloadProgress } from "@/lib/video/progress";
import type { DownloadJob } from "@/lib/video/types";
import { buildDownloadArgs } from "./yt-dlp";
import type { createJobStore } from "./job-store";

type JobStore = ReturnType<typeof createJobStore>;
type SpawnFn = typeof nodeSpawn;

export function startDownload(input: {
  job: DownloadJob;
  url: string;
  formatId: string;
  extension: string | null;
  downloadDir: string;
  store: JobStore;
  spawn?: SpawnFn;
}): void {
  const spawn = input.spawn ?? nodeSpawn;
  mkdirSync(input.downloadDir, { recursive: true });

  const baseName = buildDownloadFileName(input.job.title, input.job.jobId, input.extension);
  const outputTemplate = path.join(input.downloadDir, baseName.replace(/\.[^.]+$/, ".%(ext)s"));
  const expectedPath = path.join(input.downloadDir, baseName);
  const args = buildDownloadArgs({
    url: input.url,
    formatId: input.formatId,
    outputTemplate
  });

  input.store.update(input.job.jobId, {
    status: "running",
    fileName: baseName,
    filePath: expectedPath,
    progress: 0
  });

  const child = spawn("yt-dlp", args) as ChildProcessWithoutNullStreams;
  let lastError = "";

  child.stdout.on("data", (chunk) => {
    const lines = String(chunk).split(/\r?\n/);
    for (const line of lines) {
      const progress = parseDownloadProgress(line);
      if (progress !== null) input.store.update(input.job.jobId, { progress });
    }
  });

  child.stderr.on("data", (chunk) => {
    lastError = String(chunk).trim() || lastError;
  });

  child.on("error", (error) => {
    input.store.update(input.job.jobId, {
      status: "failed",
      error: error.message
    });
  });

  child.on("close", (code) => {
    if (code === 0) {
      input.store.update(input.job.jobId, { status: "completed", progress: 100 });
      return;
    }

    input.store.update(input.job.jobId, {
      status: "failed",
      error: lastError || `yt-dlp exited with code ${code}`
    });
  });
}
```

- [ ] **Step 8: Verify download runner tests pass**

Run: `npm run test -- src/lib/server/download-runner.test.ts`

Expected: PASS.

- [ ] **Step 9: Write failing file lookup tests**

Create `src/lib/server/files.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { resolveCompletedFile } from "./files";

describe("resolveCompletedFile", () => {
  it("returns null for missing jobs", () => {
    expect(resolveCompletedFile(null, vi.fn())).toBeNull();
  });

  it("returns null for incomplete jobs", () => {
    expect(resolveCompletedFile({ status: "running", filePath: "/tmp/a.mp4" } as any, vi.fn())).toBeNull();
  });

  it("returns a completed existing file path", () => {
    const exists = vi.fn().mockReturnValue(true);
    const job = { status: "completed", filePath: "/tmp/a.mp4", fileName: "a.mp4" } as any;
    expect(resolveCompletedFile(job, exists)).toEqual({ path: "/tmp/a.mp4", fileName: "a.mp4" });
  });
});
```

- [ ] **Step 10: Run file lookup tests to verify they fail**

Run: `npm run test -- src/lib/server/files.test.ts`

Expected: FAIL because `src/lib/server/files.ts` does not exist.

- [ ] **Step 11: Implement file lookup**

Create `src/lib/server/files.ts`:

```ts
import { existsSync } from "node:fs";
import type { DownloadJob } from "@/lib/video/types";

export function resolveCompletedFile(
  job: DownloadJob | null,
  exists: (path: string) => boolean = existsSync
): { path: string; fileName: string } | null {
  if (!job || job.status !== "completed" || !job.filePath || !job.fileName) {
    return null;
  }

  if (!exists(job.filePath)) {
    return null;
  }

  return { path: job.filePath, fileName: job.fileName };
}
```

- [ ] **Step 12: Verify job, runner, and file tests pass**

Run: `npm run test -- src/lib/server/job-store.test.ts src/lib/server/download-runner.test.ts src/lib/server/files.test.ts`

Expected: PASS.

- [ ] **Step 13: Commit job and file modules**

```bash
git add src/lib/server/job-store.ts src/lib/server/job-store.test.ts src/lib/server/download-runner.ts src/lib/server/download-runner.test.ts src/lib/server/files.ts src/lib/server/files.test.ts
git commit -m "feat: add download job orchestration"
```

## Task 6: Add API Routes

**Files:**
- Create: `src/lib/server/api-errors.ts`
- Create: `src/app/api/health/route.ts`
- Create: `src/app/api/analyze/route.ts`
- Create: `src/app/api/downloads/route.ts`
- Create: `src/app/api/downloads/[id]/route.ts`
- Create: `src/app/api/files/[id]/route.ts`
- Create: `src/app/api/analyze/route.test.ts`
- Create: `src/app/api/downloads/route.test.ts`

- [ ] **Step 1: Write failing analyze route tests**

Create `src/app/api/analyze/route.test.ts`:

```ts
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
```

- [ ] **Step 2: Run analyze route tests to verify they fail**

Run: `npm run test -- src/app/api/analyze/route.test.ts`

Expected: FAIL because route files do not exist.

- [ ] **Step 3: Implement API error helper and analyze route**

Create `src/lib/server/api-errors.ts`:

```ts
import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
```

Create `src/app/api/analyze/route.ts`:

```ts
import { NextResponse } from "next/server";
import { parseSupportedVideoUrl } from "@/lib/video/url";
import { jsonError, readJsonBody } from "@/lib/server/api-errors";
import { fetchVideoInfo } from "@/lib/server/yt-dlp";

export async function POST(request: Request) {
  const body = await readJsonBody<{ url?: unknown }>(request);
  if (!body || typeof body.url !== "string") {
    return jsonError("A video URL is required.", 400);
  }

  const parsed = parseSupportedVideoUrl(body.url);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  try {
    const result = await fetchVideoInfo(parsed.url);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to analyze video.";
    return jsonError(message, 502);
  }
}
```

- [ ] **Step 4: Verify analyze route tests pass**

Run: `npm run test -- src/app/api/analyze/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing downloads route tests**

Create `src/app/api/downloads/route.test.ts`:

```ts
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
```

- [ ] **Step 6: Run downloads route tests to verify they fail**

Run: `npm run test -- src/app/api/downloads/route.test.ts`

Expected: FAIL because `src/app/api/downloads/route.ts` does not exist.

- [ ] **Step 7: Implement health, downloads, status, and file routes**

Create `src/app/api/health/route.ts`:

```ts
import { NextResponse } from "next/server";
import { checkDependencies } from "@/lib/server/dependencies";

export async function GET() {
  return NextResponse.json({ dependencies: await checkDependencies() });
}
```

Create `src/app/api/downloads/route.ts`:

```ts
import path from "node:path";
import { NextResponse } from "next/server";
import { parseSupportedVideoUrl } from "@/lib/video/url";
import { jsonError, readJsonBody } from "@/lib/server/api-errors";
import { jobStore } from "@/lib/server/job-store";
import { startDownload } from "@/lib/server/download-runner";

export async function POST(request: Request) {
  const body = await readJsonBody<{
    url?: unknown;
    formatId?: unknown;
    title?: unknown;
    extension?: unknown;
  }>(request);

  if (!body || typeof body.url !== "string" || typeof body.formatId !== "string") {
    return jsonError("A video URL and format id are required.", 400);
  }

  const parsed = parseSupportedVideoUrl(body.url);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const title = typeof body.title === "string" && body.title.trim() ? body.title : "Untitled video";
  const extension = typeof body.extension === "string" ? body.extension : null;
  const job = jobStore.create({ title });

  startDownload({
    job,
    url: parsed.url,
    formatId: body.formatId,
    extension,
    downloadDir: path.join(process.cwd(), "downloads"),
    store: jobStore
  });

  return NextResponse.json({ jobId: job.jobId, status: job.status });
}
```

Create `src/app/api/downloads/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-errors";
import { jobStore } from "@/lib/server/job-store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = jobStore.get(id);
  if (!job) return jsonError("Download job not found.", 404);
  return NextResponse.json({
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    title: job.title,
    fileName: job.fileName,
    error: job.error
  });
}
```

Create `src/app/api/files/[id]/route.ts`:

```ts
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-errors";
import { resolveCompletedFile } from "@/lib/server/files";
import { jobStore } from "@/lib/server/job-store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const file = resolveCompletedFile(jobStore.get(id));
  if (!file) return jsonError("Completed file not found.", 404);

  const bytes = await readFile(file.path);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.fileName)}"`
    }
  });
}
```

- [ ] **Step 8: Verify API route tests pass**

Run: `npm run test -- src/app/api/analyze/route.test.ts src/app/api/downloads/route.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit API routes**

```bash
git add src/lib/server/api-errors.ts src/app/api
git commit -m "feat: add downloader api routes"
```

## Task 7: Build the Downloader UI

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/page.test.tsx`

- [ ] **Step 1: Replace the scaffold smoke test with a failing UI test**

Replace `src/app/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("renders the URL form and format area", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Video Downloader" })).toBeInTheDocument();
    expect(screen.getByLabelText("Video URL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeInTheDocument();
    expect(screen.getByText("Formats")).toBeInTheDocument();
    expect(screen.getByText("Downloads")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run UI test to verify it fails**

Run: `npm run test -- src/app/page.test.tsx`

Expected: FAIL because the current page does not render the required controls.

- [ ] **Step 3: Implement the client UI**

Replace `src/app/page.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalyzeResult, DownloadJob, VideoFormat } from "@/lib/video/types";

type JobView = Pick<DownloadJob, "jobId" | "status" | "progress" | "title" | "fileName" | "error">;

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [selectedFormatId, setSelectedFormatId] = useState("");
  const [jobs, setJobs] = useState<JobView[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedFormat = useMemo(
    () => analysis?.formats.find((format) => format.id === selectedFormatId) ?? null,
    [analysis, selectedFormatId]
  );

  async function analyze() {
    setBusy(true);
    setMessage(null);
    setAnalysis(null);

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    const data = await response.json();

    setBusy(false);
    if (!response.ok) {
      setMessage(data.error ?? "Failed to analyze video.");
      return;
    }

    setAnalysis(data);
    setSelectedFormatId(data.formats[0]?.id ?? "");
  }

  async function startSelectedDownload() {
    if (!analysis || !selectedFormat) return;
    setBusy(true);
    setMessage(null);

    const response = await fetch("/api/downloads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formatId: selectedFormat.id,
        title: analysis.video.title,
        extension: selectedFormat.extension
      })
    });
    const data = await response.json();

    setBusy(false);
    if (!response.ok) {
      setMessage(data.error ?? "Failed to start download.");
      return;
    }

    setJobs((current) => [
      {
        jobId: data.jobId,
        status: data.status,
        progress: 0,
        title: analysis.video.title,
        fileName: null,
        error: null
      },
      ...current
    ]);
  }

  useEffect(() => {
    if (jobs.length === 0) return;

    const interval = window.setInterval(async () => {
      const activeJobs = jobs.filter((job) => job.status === "queued" || job.status === "running");
      if (activeJobs.length === 0) return;

      const updates = await Promise.all(
        activeJobs.map(async (job) => {
          const response = await fetch(`/api/downloads/${job.jobId}`);
          return response.ok ? ((await response.json()) as JobView) : job;
        })
      );

      setJobs((current) =>
        current.map((job) => updates.find((update) => update.jobId === job.jobId) ?? job)
      );
    }, 1000);

    return () => window.clearInterval(interval);
  }, [jobs]);

  return (
    <main className="shell">
      <section className="hero">
        <h1>Video Downloader</h1>
        <p>Local downloads for public Bilibili and YouTube videos.</p>
      </section>

      <section className="workspace">
        <div className="panel">
          <label className="field">
            <span>Video URL</span>
            <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.bilibili.com/video/..." />
          </label>
          <button className="primary" onClick={analyze} disabled={busy || !url.trim()}>
            Analyze
          </button>
          {message ? <p className="error">{message}</p> : null}

          {analysis ? (
            <div className="summary">
              <h2>{analysis.video.title}</h2>
              <p>{analysis.video.source} · {analysis.video.durationSeconds ?? "unknown"} seconds</p>
            </div>
          ) : null}
        </div>

        <div className="panel">
          <div className="panelHeader">
            <h2>Formats</h2>
            <button className="primary" onClick={startSelectedDownload} disabled={!selectedFormat || busy}>
              Download selected format
            </button>
          </div>
          <div className="formatList">
            {(analysis?.formats ?? []).map((format: VideoFormat) => (
              <label key={format.id} className="formatRow">
                <input
                  type="radio"
                  name="format"
                  checked={selectedFormatId === format.id}
                  onChange={() => setSelectedFormatId(format.id)}
                />
                <span>{format.label}</span>
                <small>{format.sizeBytes ? `${Math.round(format.sizeBytes / 1024 / 1024)} MB` : "size unknown"}</small>
              </label>
            ))}
            {!analysis ? <p className="muted">Analyze a URL to see available formats.</p> : null}
          </div>
        </div>

        <div className="panel">
          <h2>Downloads</h2>
          <div className="jobList">
            {jobs.map((job) => (
              <div className="job" key={job.jobId}>
                <div>
                  <strong>{job.title}</strong>
                  <p>{job.status} · {job.progress}%</p>
                  {job.error ? <p className="error">{job.error}</p> : null}
                </div>
                {job.status === "completed" ? (
                  <a className="downloadLink" href={`/api/files/${job.jobId}`}>
                    Download file
                  </a>
                ) : null}
              </div>
            ))}
            {jobs.length === 0 ? <p className="muted">Started downloads appear here.</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Implement responsive styling**

Replace `src/app/globals.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #f5f7fb;
  color: #172033;
  font-family: Arial, Helvetica, sans-serif;
}

button,
input {
  font: inherit;
}

.shell {
  min-height: 100vh;
  padding: 28px;
}

.hero {
  max-width: 1120px;
  margin: 0 auto 18px;
}

.hero h1 {
  margin: 0 0 8px;
  font-size: 34px;
}

.hero p,
.muted {
  color: #647087;
}

.workspace {
  max-width: 1120px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.panel {
  background: #ffffff;
  border: 1px solid #dce3ee;
  border-radius: 8px;
  padding: 18px;
}

.panel:first-child,
.panel:last-child {
  grid-column: 1 / -1;
}

.field {
  display: grid;
  gap: 8px;
}

.field span,
.panelHeader h2,
.panel h2 {
  margin: 0;
}

.field input {
  width: 100%;
  border: 1px solid #bfc9d8;
  border-radius: 6px;
  padding: 11px 12px;
}

.primary,
.downloadLink {
  border: 0;
  border-radius: 6px;
  background: #1f6feb;
  color: #ffffff;
  padding: 10px 14px;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.primary:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.panel > .primary {
  margin-top: 12px;
}

.error {
  color: #b42318;
}

.summary {
  border-top: 1px solid #e7ecf3;
  margin-top: 16px;
  padding-top: 16px;
}

.panelHeader {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.formatList,
.jobList {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.formatRow,
.job {
  border: 1px solid #dce3ee;
  border-radius: 8px;
  padding: 12px;
}

.formatRow {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
}

.formatRow small,
.job p {
  color: #647087;
}

.job {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

@media (max-width: 760px) {
  .shell {
    padding: 18px;
  }

  .workspace {
    grid-template-columns: 1fr;
  }

  .panelHeader,
  .job {
    align-items: stretch;
    flex-direction: column;
  }

  .formatRow {
    grid-template-columns: auto 1fr;
  }

  .formatRow small {
    grid-column: 2;
  }
}
```

- [ ] **Step 5: Verify UI test passes**

Run: `npm run test -- src/app/page.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit UI**

```bash
git add src/app/page.tsx src/app/globals.css src/app/page.test.tsx
git commit -m "feat: build downloader ui"
```

## Task 8: Run Full Verification and Manual Acceptance

**Files:**
- Modify only if verification exposes a specific bug.

- [ ] **Step 1: Run all automated tests**

Run: `npm run test`

Expected: All tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: Next.js build succeeds.

- [ ] **Step 3: Start the local dev server**

Run: `npm run dev`

Expected: The server starts and prints a local URL, usually `http://localhost:3000`.

- [ ] **Step 4: Verify dependency health**

Open: `http://localhost:3000/api/health`

Expected when dependencies are installed:

```json
{
  "dependencies": [
    { "name": "yt-dlp", "available": true },
    { "name": "ffmpeg", "available": true }
  ]
}
```

- [ ] **Step 5: Manual YouTube acceptance test**

In the UI:

1. Paste a public YouTube URL.
2. Click `Analyze`.
3. Confirm formats appear.
4. Select one format.
5. Click `Download selected format`.
6. Wait until the job shows `completed`.
7. Click `Download file`.

Expected: A file downloads from the browser and the file also exists under `downloads/`.

- [ ] **Step 6: Manual Bilibili acceptance test**

Repeat Step 5 with a public Bilibili URL.

Expected: Formats appear and a selected public format downloads. If Bilibili blocks the public URL without cookies, the UI shows a failed job with a clear `yt-dlp` error.

- [ ] **Step 7: Commit verification fixes if needed**

If Step 1 or Step 2 required fixes:

```bash
git add src package.json package-lock.json tsconfig.json next.config.ts vitest.config.ts
git commit -m "fix: stabilize downloader verification"
```

If no fixes were needed, do not create an empty commit.
