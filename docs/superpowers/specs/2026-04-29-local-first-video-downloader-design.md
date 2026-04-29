# Local-First Video Downloader Design

## Context

The deployed Vercel app can package `yt-dlp` and `ffmpeg`, but YouTube commonly blocks requests from cloud/serverless IPs with bot or sign-in challenges. Vercel functions also have temporary storage and runtime limits, which makes long video downloads unreliable.

The downloader should therefore switch to a local-first architecture: users run the app on their own machine, and all analysis and downloads happen in that local server process.

## Goals

- Make the primary supported workflow local execution.
- Download files to the local project `downloads/` directory.
- Keep the existing browser UI and server-side download flow.
- Keep the retention policy that preserves only the 10 newest completed local downloads.
- Avoid presenting Vercel as a working cloud downloader for YouTube.
- Keep the Vercel deployment useful as a lightweight entry/instructions page or demo shell.

## Non-Goals

- Do not build a remote cloud download worker.
- Do not add YouTube account cookies, cookie upload, or browser-cookie extraction.
- Do not build a local background agent that is controlled by the Vercel site.
- Do not bypass platform access controls.

## Proposed Architecture

The app remains a Next.js app, but the supported downloader mode is `local`.

In local mode:

- The user starts the app with a local command such as `npm run dev` or a dedicated `npm run local`.
- The browser opens the local app URL.
- API routes call `yt-dlp` and `ffmpeg` from the local Node process.
- Downloads are saved to `downloads/` under the project root.
- Completed files are exposed through the existing `/api/files/[id]` endpoint.

In Vercel mode:

- The app should not encourage cloud YouTube downloading.
- If the server detects `process.env.VERCEL`, the UI should clearly show that full downloading is local-first and provide local run instructions.
- Health checks may still report binary availability, but Vercel should not be treated as the recommended runtime for actual downloads.

## Data Flow

1. User starts the local app.
2. User enters a Bilibili or YouTube URL in the UI.
3. UI calls `/api/analyze`.
4. Local API runs `yt-dlp --dump-single-json`.
5. UI displays normalized formats.
6. User selects a format and starts a download.
7. Local API creates a job and spawns `yt-dlp`.
8. Progress updates are parsed from stdout and stored in memory.
9. Completed output is saved under `downloads/`.
10. UI shows a "Download file" button that streams the local file from `/api/files/[id]`.
11. After each successful completion, the server deletes older completed files so only the 10 newest remain.

## Runtime Detection

The app should expose a small runtime/status response for the UI, most likely through the existing `/api/health` endpoint:

- `mode: "local" | "vercel"`
- dependency availability for `yt-dlp` and `ffmpeg`
- a local-first warning when mode is `vercel`

The UI should use this response to decide whether to enable downloader actions.

## Error Handling

- Missing local binaries: show an actionable local setup message.
- YouTube bot/sign-in challenge: show a concise message explaining that cloud or network reputation can block the request, and recommend running locally from the user's own network.
- Vercel mode: disable or discourage analyze/download actions for YouTube cloud usage, with a local setup callout.
- Download failures: keep existing job error display, but avoid leaking full shell commands when the error matches known platform challenges.

## Testing

Add focused tests for:

- Runtime detection returns `local` by default and `vercel` when `process.env.VERCEL` is set.
- Download directory resolves to project `downloads/` in local mode.
- Vercel mode exposes a local-first warning.
- UI disables or clearly warns about cloud downloading when health reports Vercel mode.
- Existing analyze/download tests still pass in local mode.
- Retention tests continue to prove only the 10 newest completed files are preserved.

## Documentation

Update README to make local mode the primary path:

- Install dependencies with `npm install`.
- Run locally with `npm run dev` or `npm run local`.
- Open the local URL.
- Explain that Vercel is not a reliable runtime for YouTube downloads because of cloud IP bot challenges and function limits.

## Deployment Impact

Vercel can stay deployed for discovery and routing from CyberShiba, but it should no longer be described as the production downloader runtime. The working product is the local app process.
