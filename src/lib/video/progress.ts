export function parseDownloadProgress(line: string): number | null {
  const match = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
  if (!match) return null;

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, parsed));
}
