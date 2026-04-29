import { normalizeYtDlpInfo } from "@/lib/video/formats";
import type { AnalyzeResult } from "@/lib/video/types";
import { defaultCommandRunner, type CommandRunner } from "./dependencies";

const nodeJsRuntime = `node:${process.execPath}`;
const youtubeBotChallengeMessage =
  "YouTube blocked this cloud request with a bot or sign-in challenge. Try another public video, run the app locally from your own network, or use a non-YouTube source.";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function formatYtDlpError(error: unknown): string {
  const message = errorMessage(error);

  if (/sign in to confirm.*not a bot/i.test(message)) {
    return youtubeBotChallengeMessage;
  }

  return message;
}

export async function fetchVideoInfo(
  url: string,
  run: CommandRunner = defaultCommandRunner
): Promise<AnalyzeResult> {
  let stdout: string;

  try {
    ({ stdout } = await run("yt-dlp", [
      "--dump-single-json",
      "--no-playlist",
      "--js-runtimes",
      nodeJsRuntime,
      url
    ]));
  } catch (error) {
    throw new Error(formatYtDlpError(error));
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("yt-dlp returned invalid JSON");
    }
    throw error;
  }

  return normalizeYtDlpInfo(parsed);
}

export function buildDownloadArgs(input: {
  url: string;
  formatId: string;
  outputTemplate: string;
  ffmpegLocation?: string;
}): string[] {
  return [
    "--newline",
    "--no-playlist",
    "-f",
    input.formatId,
    "--js-runtimes",
    nodeJsRuntime,
    ...(input.ffmpegLocation ? ["--ffmpeg-location", input.ffmpegLocation] : []),
    "--merge-output-format",
    "mp4",
    "-o",
    input.outputTemplate,
    input.url
  ];
}
