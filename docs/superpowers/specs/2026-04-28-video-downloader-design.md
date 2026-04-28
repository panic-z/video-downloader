# Video Downloader Design

Date: 2026-04-28

## Goal

Build a local-only video download web app for personal use. Users paste a Bilibili or YouTube public video URL, inspect available formats, choose one quality/format, start a backend download, then download the completed file from the web UI.

## Scope

In scope:

- Local Next.js full-stack app.
- Supports public Bilibili and YouTube URLs through local `yt-dlp`.
- Requires local `yt-dlp` and `ffmpeg`.
- Parses video metadata before download.
- Displays real format options returned by `yt-dlp`.
- Downloads selected format to a project-local `downloads/` directory.
- Shows download progress and final "download file" action in the browser.
- Keeps download task state in memory for the first version.

Out of scope for the first version:

- Public hosted multi-user service.
- User accounts, database, auth, quotas, or billing.
- Login/cookies support for restricted videos.
- Automatic file deletion.
- Browser extension behavior.
- Streaming directly to browser without backend file storage.

## Product Flow

The app is a single-page tool.

1. User enters a video URL.
2. User clicks `Analyze`.
3. The backend calls `yt-dlp -J` and returns video metadata plus a normalized format list.
4. The UI shows title, duration, source, and available formats.
5. User selects one format.
6. User starts the download.
7. The backend creates a download job and runs `yt-dlp` with the selected format.
8. The UI polls job status and shows progress.
9. When complete, the UI shows a `Download file` button.
10. Browser downloads the completed file from the backend.

## Architecture

Use a Next.js app with App Router.

- React page: URL form, metadata display, format table, download task list.
- API routes: analyze URLs, create download jobs, query job status, serve completed files.
- Download service: wraps `yt-dlp` and `ffmpeg` process execution.
- Job store: in-memory map keyed by generated job id.
- File store: project-local `downloads/` directory.

The app stays local. It does not expose a public download platform and does not persist task state across server restarts.

## API Design

`POST /api/analyze`

Request:

```json
{
  "url": "https://www.bilibili.com/video/..."
}
```

Response:

```json
{
  "video": {
    "id": "string",
    "title": "string",
    "source": "youtube|bilibili|other",
    "durationSeconds": 123
  },
  "formats": [
    {
      "id": "string",
      "label": "1080p mp4",
      "height": 1080,
      "extension": "mp4",
      "hasVideo": true,
      "hasAudio": true,
      "sizeBytes": 123456789
    }
  ]
}
```

`POST /api/downloads`

Request:

```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "formatId": "string"
}
```

Response:

```json
{
  "jobId": "string",
  "status": "queued"
}
```

`GET /api/downloads/:id`

Response:

```json
{
  "jobId": "string",
  "status": "queued|running|completed|failed",
  "progress": 62,
  "title": "string",
  "fileName": "string",
  "error": null
}
```

`GET /api/files/:id`

Returns the completed file as an attachment when the job exists, is completed, and the file still exists. Returns 404 when the job or file is missing.

## Format Handling

The backend normalizes `yt-dlp` JSON into display-friendly format rows. The first version favors formats that include both video and audio when available. If a selected format requires merging, `yt-dlp` uses `ffmpeg` to merge or remux into a browser-friendly file when possible.

The UI displays the real parsed format list rather than simplified quality presets. This avoids guessing across Bilibili and YouTube differences.

## Error Handling

- Missing `yt-dlp`: show a dependency error and block analyze/download actions.
- Missing `ffmpeg`: show a dependency warning or error when a selected format requires merging.
- Unsupported URL: return a structured analyze error and show a clear UI message.
- Analyze failure: show the main `yt-dlp` error without dumping excessive logs.
- Download failure: mark the job as failed and show the failure reason.
- Interrupted download: mark the job as failed and do not expose a file link.
- Missing completed file: return 404 and show that the file is missing or was removed.

## Storage

Downloaded files are stored in `downloads/` at the project root. The first version does not automatically delete files. Filenames are sanitized and include a job-specific suffix when needed to avoid collisions.

`downloads/` is ignored by git.

## Testing

Automated tests:

- URL validation.
- `yt-dlp` JSON normalization.
- Format label generation.
- Command argument construction.
- Download progress output parsing.
- API behavior with mocked child processes.

Manual acceptance tests:

- Analyze and download one public YouTube video.
- Analyze and download one public Bilibili video.
- Verify missing dependency messages by running without `yt-dlp` or `ffmpeg`.
- Verify failed jobs do not expose file links.

## Implementation Notes

- Do not run real network downloads in automated tests.
- Do not support cookies in the first version.
- Keep command execution isolated in a small backend module so the UI and API are testable without invoking `yt-dlp`.
- Keep task state in memory until there is a concrete need for persistence.
