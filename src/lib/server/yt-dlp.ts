import { normalizeYtDlpInfo } from "@/lib/video/formats";
import type { AnalyzeResult } from "@/lib/video/types";
import { defaultCommandRunner, type CommandRunner } from "./dependencies";

export async function fetchVideoInfo(
  url: string,
  run: CommandRunner = defaultCommandRunner
): Promise<AnalyzeResult> {
  const { stdout } = await run("yt-dlp", ["--dump-single-json", "--no-playlist", url]);
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
