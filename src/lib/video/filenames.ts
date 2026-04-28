const RESERVED_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

export function sanitizeFileName(title: string): string {
  const cleaned = title.trim().replace(RESERVED_CHARS, "_").replace(/\s+/g, " ");
  return cleaned.length > 0 ? cleaned.slice(0, 120) : "video";
}

export function buildDownloadFileName(title: string, jobId: string, extension: string | null): string {
  const safeTitle = sanitizeFileName(title);
  const suffix = jobId.slice(0, 12);
  const safeExt = extension?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "mp4";
  return `${safeTitle}-${suffix}.${safeExt}`;
}
