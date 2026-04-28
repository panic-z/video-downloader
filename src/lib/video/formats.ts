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
