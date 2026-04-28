import { detectVideoSource } from "./url";
import type { AnalyzeResult, VideoFormat, VideoSource } from "./types";

type RawInfo = {
  id?: unknown;
  title?: unknown;
  webpage_url?: unknown;
  duration?: unknown;
  formats?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
  const quality = format.height ? `${format.height}p` : format.hasVideo ? "unknown" : "audio";
  const ext = format.extension ?? "unknown";
  const media =
    format.hasVideo && format.hasAudio ? "video+audio" : format.hasVideo ? "video" : "audio";
  return `${quality} ${ext} ${media}`;
}

function normalizeFormat(raw: unknown): VideoFormat | null {
  if (!isRecord(raw)) return null;

  const id = text(raw.format_id, "");
  if (!id) return null;

  const extension = typeof raw.ext === "string" ? raw.ext : null;
  const height = numberOrNull(raw.height);
  const hasVideo = typeof raw.vcodec === "string" && raw.vcodec !== "none";
  const hasAudio = typeof raw.acodec === "string" && raw.acodec !== "none";
  if (!hasVideo && !hasAudio) return null;

  const sizeBytes = numberOrNull(raw.filesize) ?? numberOrNull(raw.filesize_approx);

  const normalized = { id, height, extension, hasVideo, hasAudio, sizeBytes };
  return { ...normalized, label: labelFor(normalized) };
}

export function normalizeYtDlpInfo(rawInfo: unknown): AnalyzeResult {
  const info: RawInfo = isRecord(rawInfo) ? rawInfo : {};
  const rawFormats = Array.isArray(info.formats) ? info.formats : [];
  const formats = rawFormats
    .map((raw) => normalizeFormat(raw))
    .filter((format): format is VideoFormat => Boolean(format))
    .sort((a, b) => {
      const videoDelta = Number(b.hasVideo) - Number(a.hasVideo);
      if (videoDelta !== 0) return videoDelta;
      return (b.height ?? 0) - (a.height ?? 0);
    });

  return {
    video: {
      id: text(info.id, "unknown"),
      title: text(info.title, "Untitled video"),
      source: sourceFromWebpageUrl(info.webpage_url),
      durationSeconds: numberOrNull(info.duration)
    },
    formats
  };
}
