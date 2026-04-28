export type VideoSource = "youtube" | "bilibili" | "other";

export type VideoFormat = {
  id: string;
  label: string;
  height: number | null;
  extension: string | null;
  hasVideo: boolean;
  hasAudio: boolean;
  sizeBytes: number | null;
};

export type VideoInfo = {
  id: string;
  title: string;
  source: VideoSource;
  durationSeconds: number | null;
};

export type AnalyzeResult = {
  video: VideoInfo;
  formats: VideoFormat[];
};

export type DownloadJobStatus = "queued" | "running" | "completed" | "failed";

export type DownloadJob = {
  jobId: string;
  status: DownloadJobStatus;
  progress: number;
  title: string;
  fileName: string | null;
  filePath: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
};
