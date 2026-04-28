"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalyzeResult, DownloadJob, VideoFormat } from "@/lib/video/types";

type JobView = Pick<DownloadJob, "jobId" | "status" | "progress" | "title" | "fileName" | "error">;

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [selectedFormatId, setSelectedFormatId] = useState("");
  const [jobs, setJobs] = useState<JobView[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedFormat = useMemo(
    () => analysis?.formats.find((format) => format.id === selectedFormatId) ?? null,
    [analysis, selectedFormatId]
  );

  async function analyze() {
    setBusy(true);
    setMessage(null);
    setAnalysis(null);

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    const data = await response.json();

    setBusy(false);
    if (!response.ok) {
      setMessage(data.error ?? "Failed to analyze video.");
      return;
    }

    setAnalysis(data);
    setSelectedFormatId(data.formats[0]?.id ?? "");
  }

  async function startSelectedDownload() {
    if (!analysis || !selectedFormat) return;
    setBusy(true);
    setMessage(null);

    const response = await fetch("/api/downloads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formatId: selectedFormat.id,
        title: analysis.video.title,
        extension: selectedFormat.extension
      })
    });
    const data = await response.json();

    setBusy(false);
    if (!response.ok) {
      setMessage(data.error ?? "Failed to start download.");
      return;
    }

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
  }

  useEffect(() => {
    if (jobs.length === 0) return;

    const interval = window.setInterval(async () => {
      const activeJobs = jobs.filter((job) => job.status === "queued" || job.status === "running");
      if (activeJobs.length === 0) return;

      const updates = await Promise.all(
        activeJobs.map(async (job) => {
          const response = await fetch(`/api/downloads/${job.jobId}`);
          return response.ok ? ((await response.json()) as JobView) : job;
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
            <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.bilibili.com/video/..." />
          </label>
          <button className="primary" onClick={analyze} disabled={busy || !url.trim()}>
            Analyze
          </button>
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
            <button className="primary" onClick={startSelectedDownload} disabled={!selectedFormat || busy}>
              Download selected format
            </button>
          </div>
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
            {!analysis ? <p className="muted">Analyze a URL to see available formats.</p> : null}
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
