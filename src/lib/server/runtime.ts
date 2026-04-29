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
