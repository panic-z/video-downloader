"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalyzeResult, DownloadJob, VideoFormat } from "@/lib/video/types";

type JobView = Pick<DownloadJob, "jobId" | "status" | "progress" | "title" | "fileName" | "error">;
type DependencyView = {
  name: string;
  available: boolean;
};

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function messageFromResponse(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return data.error;
  }

  return fallback;
}

function isAnalyzeResult(data: unknown): data is AnalyzeResult {
  return Boolean(
    data &&
      typeof data === "object" &&
      "video" in data &&
      "formats" in data &&
      Array.isArray(data.formats)
  );
}

function isJobView(data: unknown): data is JobView {
  return Boolean(
    data &&
      typeof data === "object" &&
      "jobId" in data &&
      typeof data.jobId === "string" &&
      "status" in data &&
      typeof data.status === "string" &&
      "progress" in data &&
      typeof data.progress === "number"
  );
}

function isDownloadStart(data: unknown): data is Pick<JobView, "jobId" | "status"> {
  return Boolean(
    data &&
      typeof data === "object" &&
      "jobId" in data &&
      typeof data.jobId === "string" &&
      "status" in data &&
      typeof data.status === "string"
  );
}

function isHealthResult(data: unknown): data is { dependencies: DependencyView[] } {
  return Boolean(
    data &&
      typeof data === "object" &&
      "dependencies" in data &&
      Array.isArray(data.dependencies) &&
      data.dependencies.every(
        (dependency) =>
          dependency &&
          typeof dependency === "object" &&
          "name" in dependency &&
          typeof dependency.name === "string" &&
          "available" in dependency &&
          typeof dependency.available === "boolean"
      )
  );
}

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [selectedFormatId, setSelectedFormatId] = useState("");
  const [jobs, setJobs] = useState<JobView[]>([]);
  const [busyAction, setBusyAction] = useState<"analyze" | "download" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const [dependenciesChecking, setDependenciesChecking] = useState(true);
  const [dependenciesReady, setDependenciesReady] = useState(false);
  const [dependencyMessage, setDependencyMessage] = useState<string | null>(null);
  const analyzeRequestId = useRef(0);

  const selectedFormat = useMemo(
    () => analysis?.formats.find((format) => format.id === selectedFormatId) ?? null,
    [analysis, selectedFormatId]
  );

  const actionsDisabled = Boolean(busyAction) || !dependenciesReady;

  function handleUrlChange(nextUrl: string) {
    analyzeRequestId.current += 1;
    setUrl(nextUrl);
    setAnalysis(null);
    setSelectedFormatId("");
    setDownloadMessage(null);
    setMessage(null);
    setBusyAction((current) => (current === "analyze" ? null : current));
  }

  async function analyze() {
    const requestId = analyzeRequestId.current + 1;
    analyzeRequestId.current = requestId;
    const requestUrl = url;

    setBusyAction("analyze");
    setMessage(null);
    setDownloadMessage(null);
    setAnalysis(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: requestUrl })
      });
      const data = await readJson(response);
      if (analyzeRequestId.current !== requestId) return;

      if (!response.ok) {
        setMessage(messageFromResponse(data, "Failed to analyze video."));
        return;
      }

      if (!isAnalyzeResult(data)) {
        setMessage("Failed to analyze video.");
        return;
      }

      setAnalysis(data);
      setSelectedFormatId(data.formats[0]?.id ?? "");
    } catch {
      if (analyzeRequestId.current !== requestId) return;
      setMessage("Failed to analyze video.");
    } finally {
      if (analyzeRequestId.current === requestId) {
        setBusyAction(null);
      }
    }
  }

  async function startSelectedDownload() {
    if (!analysis || !selectedFormat) return;
    setBusyAction("download");
    setMessage(null);
    setDownloadMessage("Starting download job...");

    try {
      const response = await fetch("/api/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          formatId: selectedFormat.downloadSelector,
          title: analysis.video.title,
          extension: selectedFormat.extension
        })
      });
      const data = await readJson(response);

      if (!response.ok) {
        setDownloadMessage(null);
        setMessage(messageFromResponse(data, "Failed to start download."));
        return;
      }

      if (!isDownloadStart(data)) {
        setDownloadMessage(null);
        setMessage("Failed to start download.");
        return;
      }

      setDownloadMessage("Download job started. Track progress in Downloads.");
      setJobs((current) => [
        {
          jobId: data.jobId,
          status: data.status,
          progress: 0,
          title: analysis.video.title,
          fileName: null,
          error: null
        },
        ...current
      ]);
    } catch {
      setDownloadMessage(null);
      setMessage("Failed to start download.");
    } finally {
      setBusyAction(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const response = await fetch("/api/health");
        const data = await readJson(response);
        if (cancelled) return;

        if (!response.ok || !isHealthResult(data)) {
          setDependencyMessage("Could not verify downloader dependencies. Install yt-dlp and ffmpeg, then refresh.");
          return;
        }

        const missing = data.dependencies
          .filter((dependency) => !dependency.available)
          .map((dependency) => dependency.name);

        if (missing.length > 0) {
          const label = missing.length === 1 ? "dependency" : "dependencies";
          setDependencyMessage(
            `Missing ${label}: ${missing.join(", ")}. Install yt-dlp and ffmpeg to enable downloads.`
          );
          return;
        }

        setDependencyMessage(null);
        setDependenciesReady(true);
      } catch {
        if (!cancelled) {
          setDependencyMessage("Could not verify downloader dependencies. Install yt-dlp and ffmpeg, then refresh.");
        }
      } finally {
        if (!cancelled) {
          setDependenciesChecking(false);
        }
      }
    }

    void checkHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const activeJobs = jobs.filter((job) => job.status === "queued" || job.status === "running");
    if (activeJobs.length === 0) return;

    const interval = window.setInterval(async () => {
      const updates = await Promise.all(
        activeJobs.map(async (job) => {
          try {
            const response = await fetch(`/api/downloads/${job.jobId}`);
            const data = await readJson(response);
            if (!response.ok) {
              return {
                ...job,
                status: "failed" as const,
                error: messageFromResponse(data, "Failed to refresh download status.")
              };
            }

            if (!isJobView(data)) {
              return {
                ...job,
                status: "failed" as const,
                error: "Failed to refresh download status."
              };
            }

            return data;
          } catch {
            return job;
          }
        })
      );

      setJobs((current) =>
        current.map((job) => updates.find((update) => update.jobId === job.jobId) ?? job)
      );
    }, 1000);

    return () => window.clearInterval(interval);
  }, [jobs]);

  return (
    <main className="shell">
      <section className="hero">
        <h1>Video Downloader</h1>
        <p>Local downloads for public Bilibili and YouTube videos.</p>
      </section>

      <section className="workspace">
        <div className="panel">
          <label className="field">
            <span>Video URL</span>
            <input
              value={url}
              onChange={(event) => handleUrlChange(event.target.value)}
              placeholder="https://www.bilibili.com/video/..."
            />
          </label>
          <button className="primary" onClick={analyze} disabled={actionsDisabled || !url.trim()}>
            {busyAction === "analyze" ? "Analyzing..." : "Analyze"}
          </button>
          {dependenciesChecking && !dependencyMessage ? (
            <p className="muted">Checking downloader dependencies...</p>
          ) : null}
          {dependencyMessage ? <p className="error">{dependencyMessage}</p> : null}
          {message ? <p className="error">{message}</p> : null}

          {analysis ? (
            <div className="summary">
              <h2>{analysis.video.title}</h2>
              <p>{analysis.video.source} · {analysis.video.durationSeconds ?? "unknown"} seconds</p>
            </div>
          ) : null}
        </div>

        <div className="panel">
          <div className="panelHeader">
            <h2>Formats</h2>
            <button className="primary" onClick={startSelectedDownload} disabled={!selectedFormat || actionsDisabled}>
              {busyAction === "download" ? "Starting download..." : "Download selected format"}
            </button>
          </div>
          {downloadMessage ? <p className="muted">{downloadMessage}</p> : null}
          <div className="formatList">
            {(analysis?.formats ?? []).map((format: VideoFormat) => (
              <label key={format.id} className="formatRow">
                <input
                  type="radio"
                  name="format"
                  checked={selectedFormatId === format.id}
                  onChange={() => setSelectedFormatId(format.id)}
                />
                <span>{format.label}</span>
                <small>{format.sizeBytes ? `${Math.round(format.sizeBytes / 1024 / 1024)} MB` : "size unknown"}</small>
              </label>
            ))}
            {busyAction === "analyze" ? (
              <p className="muted">Analyzing video and loading formats...</p>
            ) : null}
            {!analysis && busyAction !== "analyze" ? (
              <p className="muted">Analyze a URL to see available formats.</p>
            ) : null}
            {analysis && analysis.formats.length === 0 ? (
              <p className="muted">No downloadable formats found.</p>
            ) : null}
          </div>
        </div>

        <div className="panel">
          <h2>Downloads</h2>
          <div className="jobList">
            {jobs.map((job) => (
              <div className="job" key={job.jobId}>
                <div>
                  <strong>{job.title}</strong>
                  <p>{job.status} · {job.progress}%</p>
                  {job.error ? <p className="error">{job.error}</p> : null}
                </div>
                {job.status === "completed" ? (
                  <a className="downloadLink" href={`/api/files/${job.jobId}`}>
                    Download file
                  </a>
                ) : null}
              </div>
            ))}
            {jobs.length === 0 ? <p className="muted">Started downloads appear here.</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
