import { NextResponse } from "next/server";
import { parseSupportedVideoUrl } from "@/lib/video/url";
import { jsonError, readJsonBody } from "@/lib/server/api-errors";
import { getRuntimeMode, localFirstWarning } from "@/lib/server/runtime";
import { fetchVideoInfo } from "@/lib/server/yt-dlp";

export async function POST(request: Request) {
  const body = await readJsonBody<{ url?: unknown }>(request);
  if (!body || typeof body.url !== "string") {
    return jsonError("A video URL is required.", 400);
  }

  if (getRuntimeMode() === "vercel") {
    return jsonError(localFirstWarning, 409);
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
