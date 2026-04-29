import { detectVideoSource } from "./url";
import type { AnalyzeResult, VideoFormat, VideoSource } from "./types";

type RawInfo = {
  id?: unknown;
  title?: unknown;
  webpage_url?: unknown;
  duration?: unknown;
  formats?: unknown;
};

type NormalizedFormat = Omit<VideoFormat, "label"> & {
  baseLabel: string;
  formatNote: string | null;
  fps: number | null;
  bitrateKbps: number | null;
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

function qualityFromText(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/(\d{3,4})\s*[pP]\b/);
  if (!match) return null;
  return numberOrNull(Number(match[1]));
}

function displayHeight(raw: Record<string, unknown>): number | null {
  const notedQuality = qualityFromText(raw.format_note) ?? qualityFromText(raw.resolution);
  if (notedQuality) return notedQuality;

  const width = numberOrNull(raw.width);
  const height = numberOrNull(raw.height);
  if (width && height) return Math.min(width, height);
  return height;
}

function sourceFromWebpageUrl(value: unknown): VideoSource {
  if (typeof value !== "string") return "other";
  try {
    return detectVideoSource(new URL(value));
  } catch {
    return "other";
  }
}

function baseLabelFor(format: Omit<VideoFormat, "downloadSelector" | "label">): string {
  const quality = format.height ? `${format.height}p` : format.hasVideo ? "unknown" : "audio";
  const ext = format.extension ?? "unknown";
  const media = format.hasVideo ? "video+audio" : "audio";
  return `${quality} ${ext} ${media}`;
}

function labelFor(format: NormalizedFormat, duplicateBaseLabels: Set<string>): string {
  const baseLabel =
    format.hasVideo && format.fps && format.fps > 30 && format.height
      ? `${format.height}p ${Math.round(format.fps)}fps ${format.extension ?? "unknown"} video+audio`
      : format.baseLabel;

  if (!duplicateBaseLabels.has(format.baseLabel)) return baseLabel;

  const details = [
    format.formatNote,
    format.fps ? `${format.fps}fps` : null,
    format.bitrateKbps ? `${Math.round(format.bitrateKbps)}kbps` : null,
    `id ${format.id}`
  ].filter((detail): detail is string => Boolean(detail));

  return `${baseLabel} · ${details.join(" · ")}`;
}

function normalizeFormat(raw: unknown): NormalizedFormat | null {
  if (!isRecord(raw)) return null;

  const id = text(raw.format_id, "");
  if (!id) return null;

  const extension = typeof raw.ext === "string" ? raw.ext : null;
  const height = displayHeight(raw);
  const hasVideo = typeof raw.vcodec === "string" && raw.vcodec !== "none";
  const hasAudio = typeof raw.acodec === "string" && raw.acodec !== "none";
  if (!hasVideo && !hasAudio) return null;

  const sizeBytes = numberOrNull(raw.filesize) ?? numberOrNull(raw.filesize_approx);

  const normalized = { id, height, extension, hasVideo, hasAudio, sizeBytes };
  const downloadSelector = hasVideo && !hasAudio ? `${id}+bestaudio/best` : id;
  return {
    ...normalized,
    downloadSelector,
    baseLabel: baseLabelFor(normalized),
    formatNote: text(raw.format_note, "") || null,
    fps: numberOrNull(raw.fps),
    bitrateKbps: numberOrNull(raw.tbr)
  };
}

function formatScore(format: NormalizedFormat): number {
  const extensionScore = format.extension === "mp4" || format.extension === "m4a" ? 100_000 : 0;
  const knownSizeScore = format.sizeBytes ? 50_000 : 0;
  const bitrateScore = format.bitrateKbps ? Math.round(format.bitrateKbps) * 10 : 0;
  const fpsScore = format.fps ? Math.round(format.fps) * 100 : 0;
  const sizeScore = format.sizeBytes ? Math.min(Math.round(format.sizeBytes / 1024 / 1024), 10_000) : 0;
  const audioTieBreaker = format.hasAudio ? 100 : 0;
  return extensionScore + knownSizeScore + bitrateScore + fpsScore + sizeScore + audioTieBreaker;
}

function dedupeDownloadChoices(formats: NormalizedFormat[]): NormalizedFormat[] {
  const choices = new Map<string, NormalizedFormat>();

  for (const format of formats) {
    const key = format.hasVideo ? `video:${format.height ?? "unknown"}` : "audio";
    const current = choices.get(key);
    if (!current || formatScore(format) > formatScore(current)) {
      choices.set(key, format);
    }
  }

  return Array.from(choices.values());
}

export function normalizeYtDlpInfo(rawInfo: unknown): AnalyzeResult {
  const info: RawInfo = isRecord(rawInfo) ? rawInfo : {};
  const rawFormats = Array.isArray(info.formats) ? info.formats : [];
  const normalizedFormats = rawFormats
    .map((raw) => normalizeFormat(raw))
    .filter((format): format is NormalizedFormat => Boolean(format));
  const recommendedFormats = dedupeDownloadChoices(normalizedFormats)
    .sort((a, b) => {
      const videoDelta = Number(b.hasVideo) - Number(a.hasVideo);
      if (videoDelta !== 0) return videoDelta;
      const heightDelta = (b.height ?? 0) - (a.height ?? 0);
      if (heightDelta !== 0) return heightDelta;
      const fpsDelta = (b.fps ?? 0) - (a.fps ?? 0);
      if (fpsDelta !== 0) return fpsDelta;
      return (b.bitrateKbps ?? 0) - (a.bitrateKbps ?? 0);
    });
  const labelCounts = new Map<string, number>();
  for (const format of recommendedFormats) {
    labelCounts.set(format.baseLabel, (labelCounts.get(format.baseLabel) ?? 0) + 1);
  }
  const duplicateBaseLabels = new Set(
    Array.from(labelCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([label]) => label)
  );
  const formats = recommendedFormats.map(({ baseLabel, formatNote, fps, bitrateKbps, ...format }) => ({
    ...format,
    label: labelFor({ ...format, baseLabel, formatNote, fps, bitrateKbps }, duplicateBaseLabels)
  }));

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
