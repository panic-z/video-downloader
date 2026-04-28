import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomePage from "./page";

function jsonResponse(data: unknown, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(data)
  } as unknown as Response;
}

function invalidJsonResponse(ok = false) {
  return {
    ok,
    json: vi.fn().mockRejectedValue(new Error("Invalid JSON"))
  } as unknown as Response;
}

const analysisResult = {
  video: {
    id: "video-1",
    title: "A very long demo video title",
    source: "youtube",
    durationSeconds: 123
  },
  formats: [
    {
      id: "mp4-720",
      label: "720p MP4",
      height: 720,
      extension: "mp4",
      hasVideo: true,
      hasAudio: true,
      sizeBytes: 10485760
    }
  ]
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("HomePage", () => {
  it("renders the URL form and format area", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Video Downloader" })).toBeInTheDocument();
    expect(screen.getByLabelText("Video URL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeInTheDocument();
    expect(screen.getByText("Formats")).toBeInTheDocument();
    expect(screen.getByText("Downloads")).toBeInTheDocument();
  });

  it("renders video details and formats after a successful analyze request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(analysisResult));
    const user = userEvent.setup();

    render(<HomePage />);
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/watch?v=1");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    expect(await screen.findByRole("heading", { name: "A very long demo video title" })).toBeInTheDocument();
    expect(screen.getByText("720p MP4")).toBeInTheDocument();
    expect(screen.getByText("10 MB")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/watch?v=1" })
    });
  });

  it("shows a clear analyze error and clears busy state for invalid JSON responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(invalidJsonResponse(false));
    const user = userEvent.setup();

    render(<HomePage />);
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/watch?v=1");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    expect(await screen.findByText("Failed to analyze video.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeEnabled();
  });

  it("shows an explicit message when analysis returns no formats", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        ...analysisResult,
        formats: []
      })
    );
    const user = userEvent.setup();

    render(<HomePage />);
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/watch?v=1");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    expect(await screen.findByText("No downloadable formats found.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download selected format" })).toBeDisabled();
  });

  it("starts a download for the selected format", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(analysisResult))
      .mockResolvedValueOnce(jsonResponse({ jobId: "job-1", status: "queued" }));
    const user = userEvent.setup();

    render(<HomePage />);
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/watch?v=1");
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await screen.findByText("720p MP4");
    await user.click(screen.getByRole("button", { name: "Download selected format" }));

    expect(await screen.findByText("queued · 0%")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/downloads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/watch?v=1",
        formatId: "mp4-720",
        title: "A very long demo video title",
        extension: "mp4"
      })
    });
  });

  it("shows a clear download error and clears busy state when starting a download fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(analysisResult))
      .mockRejectedValueOnce(new Error("Network error"));
    const user = userEvent.setup();

    render(<HomePage />);
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/watch?v=1");
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await screen.findByText("720p MP4");
    await user.click(screen.getByRole("button", { name: "Download selected format" }));

    expect(await screen.findByText("Failed to start download.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download selected format" })).toBeEnabled();
  });

  it("polls active downloads until completion and keeps terminal jobs idle", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(analysisResult))
      .mockResolvedValueOnce(jsonResponse({ jobId: "job-1", status: "queued" }))
      .mockResolvedValueOnce(
        jsonResponse({
          jobId: "job-1",
          status: "completed",
          progress: 100,
          title: "A very long demo video title",
          fileName: "demo.mp4",
          error: null
        })
      );

    render(<HomePage />);
    fireEvent.change(screen.getByLabelText("Video URL"), {
      target: { value: "https://example.com/watch?v=1" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("720p MP4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download selected format" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("queued · 0%")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByText("completed · 100%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download file" })).toHaveAttribute("href", "/api/files/job-1");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
