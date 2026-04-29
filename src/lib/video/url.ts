import type { VideoSource } from "./types";

type ParsedUrlResult =
  | { ok: true; url: string; source: VideoSource }
  | { ok: false; error: string };

export function detectVideoSource(url: URL): VideoSource {
  const host = url.hostname.toLowerCase().replace(/\.$/, "");

  if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") {
    return "youtube";
  }

  if (host === "bilibili.com" || host.endsWith(".bilibili.com") || host === "b23.tv") {
    return "bilibili";
  }

  return "other";
}

export function parseSupportedVideoUrl(value: string): ParsedUrlResult {
  let parsed: URL;

  try {
    parsed = new URL(value.trim());
  } catch {
    return { ok: false, error: "Enter a valid URL." };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Only http and https URLs are supported." };
  }

  const source = detectVideoSource(parsed);
  if (source !== "youtube" && source !== "bilibili") {
    return { ok: false, error: "Only public Bilibili and YouTube URLs are supported." };
  }

  return { ok: true, url: parsed.toString(), source };
}
