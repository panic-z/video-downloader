import { existsSync } from "node:fs";
import path from "node:path";
import ffmpegStaticPath from "ffmpeg-static";
import youtubeDl from "youtube-dl-exec";

export type BinaryName = "yt-dlp" | "ffmpeg";

export type BinaryPaths = {
  ytDlp?: string | null;
  ffmpeg?: string | null;
};

type YoutubeDlModule = typeof youtubeDl & {
  constants?: {
    YOUTUBE_DL_PATH?: string;
  };
};

function nonEmptyPath(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function firstExistingPath(
  candidates: string[],
  exists: (candidate: string) => boolean = existsSync
): string | null {
  if (candidates.length === 0) return null;
  return candidates.find((candidate) => exists(candidate)) ?? null;
}

export function getPackagedBinaryPaths(): BinaryPaths {
  const ytDlpPath = nonEmptyPath((youtubeDl as YoutubeDlModule).constants?.YOUTUBE_DL_PATH);
  const ffmpegPath = nonEmptyPath(ffmpegStaticPath);

  return {
    ytDlp: firstExistingPath(
      [
        path.join(process.cwd(), "node_modules/youtube-dl-exec/bin/yt-dlp_linux"),
        ytDlpPath,
        path.join(process.cwd(), "node_modules/youtube-dl-exec/bin/yt-dlp")
      ].filter((candidate): candidate is string => Boolean(candidate))
    ),
    ffmpeg: firstExistingPath(
      [
        ffmpegPath,
        path.join(process.cwd(), "node_modules/ffmpeg-static/ffmpeg")
      ].filter((candidate): candidate is string => Boolean(candidate))
    )
  };
}

export function resolveBinaryPath(
  name: BinaryName,
  binaryPaths: BinaryPaths = getPackagedBinaryPaths()
): string {
  if (name === "yt-dlp") return binaryPaths.ytDlp || "yt-dlp";
  return binaryPaths.ffmpeg || "ffmpeg";
}

export function buildBinaryEnvironment(
  baseEnv: NodeJS.ProcessEnv = process.env,
  binaryPaths: BinaryPaths = getPackagedBinaryPaths()
): NodeJS.ProcessEnv {
  const ffmpegPath = resolveBinaryPath("ffmpeg", binaryPaths);
  if (ffmpegPath === "ffmpeg") return baseEnv;

  const ffmpegDir = path.dirname(ffmpegPath);
  const currentPath = baseEnv.PATH ?? "";

  return {
    ...baseEnv,
    PATH: currentPath ? `${ffmpegDir}:${currentPath}` : ffmpegDir
  };
}

export function resolveFfmpegLocation(binaryPaths: BinaryPaths = getPackagedBinaryPaths()): string | undefined {
  const ffmpegPath = resolveBinaryPath("ffmpeg", binaryPaths);
  return ffmpegPath === "ffmpeg" ? undefined : ffmpegPath;
}
