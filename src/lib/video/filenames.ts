const RESERVED_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
const MAX_TITLE_CHARS = 120;
const MAX_TITLE_BYTES = 180;
const MAX_EXTENSION_CHARS = 12;

function truncateUtf8(value: string, maxBytes: number): string {
  let bytes = 0;
  let result = "";

  for (const character of value) {
    const nextBytes = Buffer.byteLength(character);
    if (bytes + nextBytes > maxBytes) break;

    result += character;
    bytes += nextBytes;
  }

  return result;
}

function safeExtension(extension: string | null): string {
  const cleaned = extension?.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, MAX_EXTENSION_CHARS) ?? "";
  return cleaned || "mp4";
}

export function sanitizeFileName(title: string): string {
  const cleaned = title.trim().replace(RESERVED_CHARS, "_").replace(/\s+/g, " ");
  const truncated = truncateUtf8(cleaned.slice(0, MAX_TITLE_CHARS), MAX_TITLE_BYTES).trim();
  return truncated.length > 0 ? truncated : "video";
}

export function buildDownloadFileName(title: string, jobId: string, extension: string | null): string {
  const safeTitle = sanitizeFileName(title);
  const suffix = jobId.slice(0, 12);
  const safeExt = safeExtension(extension);
  return `${safeTitle}-${suffix}.${safeExt}`;
}
