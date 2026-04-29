# Local-First Video Downloader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local execution the supported downloader runtime and prevent Vercel from acting as the cloud download backend.

**Architecture:** Add a small server runtime module that detects `local` vs `vercel`, centralizes the local download directory, and exposes a local-first warning. Health reports runtime mode to the UI, API routes reject analyze/download in Vercel mode, and the client disables downloader actions when it sees Vercel mode.

**Tech Stack:** Next.js App Router, React client component, Vitest, Node `process.env`, `tmpdir`, existing `yt-dlp`/`ffmpeg` server helpers.

---

## File Structure

- Create `src/lib/server/runtime.ts`: runtime detection, local-first warning, download directory resolution.
- Create `src/lib/server/runtime.test.ts`: tests for local/vercel mode and download directory.
- Create `src/app/api/health/route.test.ts`: tests health payload includes runtime mode and warning.
- Modify `src/app/api/health/route.ts`: include runtime fields.
- Modify `src/app/api/analyze/route.ts`: reject Vercel mode with local-first warning.
- Modify `src/app/api/analyze/route.test.ts`: cover Vercel rejection and keep local behavior.
- Modify `src/app/api/downloads/route.ts`: use runtime helper for download dir and reject Vercel mode.
- Modify `src/app/api/downloads/route.test.ts`: update Vercel expectation from temp dir to local-first rejection.
- Modify `src/app/page.tsx`: parse health mode/warning and disable actions on Vercel.
- Modify `src/app/page.test.tsx`: cover Vercel mode UI warning and disabled controls.
- Modify `package.json`: add `local` script alias.
- Modify `README.md`: make local mode primary and Vercel a discovery/demo deployment only.

---

### Task 1: Server Runtime Module

**Files:**
- Create: `src/lib/server/runtime.ts`
- Create: `src/lib/server/runtime.test.ts`

- [ ] **Step 1: Write failing runtime tests**

Add `src/lib/server/runtime.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- src/lib/server/runtime.test.ts
```

Expected: fail because `src/lib/server/runtime.ts` does not exist.

- [ ] **Step 3: Implement runtime helper**

Create `src/lib/server/runtime.ts`:

```ts
import { tmpdir } from "node:os";
import path from "node:path";

export type RuntimeMode = "local" | "vercel";

export const localFirstWarning =
  "This Vercel deployment is only an entry point. Run this app locally to analyze and download videos from your own machine.";

export function getRuntimeMode(env: Partial<NodeJS.ProcessEnv> = process.env): RuntimeMode {
  return env.VERCEL ? "vercel" : "local";
}

export function getDownloadDir(
  env: Partial<NodeJS.ProcessEnv> = process.env,
  cwd = process.cwd(),
  temporaryDirectory = tmpdir()
): string {
  if (getRuntimeMode(env) === "vercel") {
    return path.join(temporaryDirectory, "video-downloader-downloads");
  }

  return path.join(cwd, "downloads");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run test -- src/lib/server/runtime.test.ts
```

Expected: all tests in `runtime.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/runtime.ts src/lib/server/runtime.test.ts
git commit -m "add local runtime detection"
```

---

### Task 2: Health And API Runtime Enforcement

**Files:**
- Create: `src/app/api/health/route.test.ts`
- Modify: `src/app/api/health/route.ts`
- Modify: `src/app/api/analyze/route.ts`
- Modify: `src/app/api/analyze/route.test.ts`
- Modify: `src/app/api/downloads/route.ts`
- Modify: `src/app/api/downloads/route.test.ts`

- [ ] **Step 1: Write failing health and route tests**

Create `src/app/api/health/route.test.ts`:

```ts
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
```

Add this test to `src/app/api/analyze/route.test.ts`:

```ts
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
});
```

Replace the Vercel temp-dir test in `src/app/api/downloads/route.test.ts` with:

```ts
it("returns a local-first error on Vercel", async () => {
  process.env.VERCEL = "1";

  const response = await POST(new Request("http://localhost/api/downloads", {
    method: "POST",
    body: JSON.stringify({
      url: "https://youtu.be/id",
      formatId: "18",
      title: "Title",
      extension: "mp4"
    })
  }));

  expect(response.status).toBe(409);
  await expect(response.json()).resolves.toEqual({
    error: expect.stringContaining("Run this app locally")
  });
  expect(jobStore.create).not.toHaveBeenCalled();
  expect(startDownload).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test -- src/app/api/health/route.test.ts src/app/api/analyze/route.test.ts src/app/api/downloads/route.test.ts
```

Expected: fail because health does not include mode/warning and API routes do not reject Vercel mode.

- [ ] **Step 3: Implement health and route enforcement**

Change `src/app/api/health/route.ts` to:

```ts
import { NextResponse } from "next/server";
import { checkDependencies } from "@/lib/server/dependencies";
import { getRuntimeMode, localFirstWarning } from "@/lib/server/runtime";

export async function GET() {
  const mode = getRuntimeMode();

  return NextResponse.json({
    mode,
    ...(mode === "vercel" ? { warning: localFirstWarning } : {}),
    dependencies: await checkDependencies()
  });
}
```

Add this guard near the start of `src/app/api/analyze/route.ts`, after parsing the body:

```ts
  if (getRuntimeMode() === "vercel") {
    return jsonError(localFirstWarning, 409);
  }
```

Import the helper:

```ts
import { getRuntimeMode, localFirstWarning } from "@/lib/server/runtime";
```

Change `src/app/api/downloads/route.ts` to import runtime helpers:

```ts
import { getDownloadDir, getRuntimeMode, localFirstWarning } from "@/lib/server/runtime";
```

Delete the local `getDownloadDir()` function and its `node:os` import, then add this guard near the start of `POST`, before creating a job:

```ts
  if (getRuntimeMode() === "vercel") {
    return jsonError(localFirstWarning, 409);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm run test -- src/lib/server/runtime.test.ts src/app/api/health/route.test.ts src/app/api/analyze/route.test.ts src/app/api/downloads/route.test.ts
```

Expected: all listed tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/runtime.ts src/lib/server/runtime.test.ts src/app/api/health/route.ts src/app/api/health/route.test.ts src/app/api/analyze/route.ts src/app/api/analyze/route.test.ts src/app/api/downloads/route.ts src/app/api/downloads/route.test.ts
git commit -m "enforce local first runtime"
```

---

### Task 3: Local-First UI Behavior

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`

- [ ] **Step 1: Write failing UI test**

Add to `src/app/page.test.tsx`:

```tsx
it("disables downloader actions and shows local-first guidance on Vercel", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    jsonResponse({
      mode: "vercel",
      warning: "This Vercel deployment is only an entry point. Run this app locally to analyze and download videos from your own machine.",
      dependencies: [
        { name: "yt-dlp", available: true },
        { name: "ffmpeg", available: true }
      ]
    })
  );
  const user = userEvent.setup();

  render(<HomePage />);
  await user.type(screen.getByLabelText("Video URL"), "https://youtu.be/id");

  expect(await screen.findByText(/Run this app locally/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Download selected format" })).toBeDisabled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- src/app/page.test.tsx
```

Expected: fail because `isHealthResult` ignores `mode` and the UI does not disable on Vercel mode.

- [ ] **Step 3: Implement UI runtime handling**

In `src/app/page.tsx`:

1. Add runtime fields to the health type:

```ts
type RuntimeMode = "local" | "vercel";
```

2. Change `isHealthResult` return type to:

```ts
function isHealthResult(data: unknown): data is {
  mode?: RuntimeMode;
  warning?: string;
  dependencies: DependencyView[];
} {
```

3. Add validation that `mode` is absent, `"local"`, or `"vercel"`, and `warning` is absent or string.

4. Add state:

```ts
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>("local");
```

5. Change `actionsDisabled`:

```ts
  const actionsDisabled = Boolean(busyAction) || !dependenciesReady || runtimeMode !== "local";
```

6. In `checkHealth`, after validating data:

```ts
        const nextMode = data.mode ?? "local";
        setRuntimeMode(nextMode);

        if (nextMode === "vercel") {
          setDependenciesReady(false);
          setDependencyMessage(
            data.warning ??
              "This Vercel deployment is only an entry point. Run this app locally to analyze and download videos from your own machine."
          );
          return;
        }
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run test -- src/app/page.test.tsx
```

Expected: all page tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/page.test.tsx
git commit -m "show local first runtime guidance"
```

---

### Task 4: Scripts, README, Final Verification, And Deployment

**Files:**
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Update local script and README**

In `package.json`, add:

```json
"local": "next dev"
```

In `README.md`, update the local development section to show:

````md
## Local Usage / 本地使用

```bash
npm install
npm run local
```

Open:

```text
http://localhost:3000/video-downloader
```

The supported downloader runtime is local. Vercel is kept as a discovery/demo deployment, but cloud IPs commonly trigger YouTube bot checks and serverless functions are not reliable for long downloads.
````

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run test
npm run lint
npm run build
npm audit
```

Expected:

- Vitest reports all test files pass.
- TypeScript exits 0.
- Next build exits 0.
- npm audit reports `found 0 vulnerabilities`.

- [ ] **Step 3: Commit**

```bash
git add package.json README.md
git commit -m "document local first usage"
```

- [ ] **Step 4: Push branch**

Run:

```bash
git push origin HEAD:main
```

Expected: GitHub `main` updates with all local-first commits.

- [ ] **Step 5: Deploy and verify Vercel entry mode**

Run:

```bash
vercel deploy --target=preview --yes
vercel deploy --prod --yes
```

Then verify the deployed API reports Vercel mode and rejects cloud analyze/download actions:

```bash
curl --noproxy '*' --max-time 40 -sS https://www.cybershiba.cn/video-downloader/api/health
curl --noproxy '*' --max-time 40 -sS -X POST https://www.cybershiba.cn/video-downloader/api/analyze -H 'content-type: application/json' -d '{"url":"https://youtu.be/id"}'
```

Expected:

- Health returns `mode: "vercel"` and a warning that tells users to run locally.
- Analyze returns HTTP 409 with the same local-first warning.

---

## Self-Review

- Spec coverage: runtime detection, local download directory, Vercel warning, UI disabling, docs, tests, and deployment are all covered by Tasks 1-4.
- Placeholder scan: no TBD/TODO placeholders are present.
- Type consistency: `RuntimeMode`, `localFirstWarning`, `getRuntimeMode`, and `getDownloadDir` are introduced in Task 1 and reused consistently in later tasks.
