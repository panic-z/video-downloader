import { act, fireEvent, render, screen, within } from "@testing-library/react";
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
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
      id: "137",
      downloadSelector: "137+bestaudio/137",
      label: "1080p mp4 video",
      height: 1080,
      extension: "mp4",
      hasVideo: true,
      hasAudio: false,
      sizeBytes: 20971520
    },
    {
      id: "18",
      downloadSelector: "18",
      label: "360p mp4 video+audio",
      height: 360,
      extension: "mp4",
      hasVideo: true,
      hasAudio: true,
      sizeBytes: 10485760
    },
    {
      id: "140",
      downloadSelector: "140",
      label: "audio m4a audio",
      height: null,
      extension: "m4a",
      hasVideo: false,
      hasAudio: true,
      sizeBytes: null
    }
  ]
};

const healthyDependencies = {
  dependencies: [
    { name: "yt-dlp", available: true },
    { name: "ffmpeg", available: true }
  ]
};

function mockFetchWithHealth(...responses: Response[]) {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(healthyDependencies));
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }
  return fetchMock;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("HomePage", () => {
  it("renders the URL form and format area", () => {
    mockFetchWithHealth();

    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Video Downloader" })).toBeInTheDocument();
    expect(screen.getByLabelText("Video URL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeInTheDocument();
    expect(screen.getByText("Formats")).toBeInTheDocument();
    expect(screen.getByText("Downloads")).toBeInTheDocument();
  });

  it("shows dependency checking feedback while health is pending", async () => {
    const healthResponse = deferred<Response>();
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(healthResponse.promise);

    render(<HomePage />);

    expect(screen.getByText("Checking downloader dependencies...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();

    await act(async () => {
      healthResponse.resolve(jsonResponse(healthyDependencies));
      await healthResponse.promise;
    });

    expect(screen.queryByText("Checking downloader dependencies...")).not.toBeInTheDocument();
  });

  it("renders video details and formats after a successful analyze request", async () => {
    const fetchMock = mockFetchWithHealth(jsonResponse(analysisResult));
    const user = userEvent.setup();

    render(<HomePage />);
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/watch?v=1");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    expect(await screen.findByRole("heading", { name: "A very long demo video title" })).toBeInTheDocument();
    expect(screen.getByText("1080p mp4 video")).toBeInTheDocument();
    expect(screen.getByText("20 MB")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/watch?v=1" })
    });
  });

  it("shows immediate feedback while analysis is running", async () => {
    const analyzeResponse = deferred<Response>();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(healthyDependencies))
      .mockReturnValueOnce(analyzeResponse.promise);
    const user = userEvent.setup();

    render(<HomePage />);
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/watch?v=1");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    expect(screen.getByRole("button", { name: "Analyzing..." })).toBeDisabled();
    expect(screen.getByText("Analyzing video and loading formats...")).toBeInTheDocument();

    await act(async () => {
      analyzeResponse.resolve(jsonResponse(analysisResult));
      await analyzeResponse.promise;
    });

    expect(await screen.findByText("1080p mp4 video")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ignores stale analysis responses after the URL changes", async () => {
    const analyzeResponse = deferred<Response>();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(healthyDependencies))
      .mockReturnValueOnce(analyzeResponse.promise);
    const user = userEvent.setup();

    render(<HomePage />);
    const urlInput = screen.getByLabelText("Video URL");
    await user.type(urlInput, "https://example.com/watch?v=1");
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await user.clear(urlInput);
    await user.type(urlInput, "https://example.com/watch?v=2");

    await act(async () => {
      analyzeResponse.resolve(jsonResponse(analysisResult));
      await analyzeResponse.promise;
    });

    expect(screen.queryByRole("heading", { name: "A very long demo video title" })).not.toBeInTheDocument();
    expect(screen.queryByText("1080p mp4 video")).not.toBeInTheDocument();
    expect(screen.getByText("Analyze a URL to see available formats.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download selected format" })).toBeDisabled();
  });

  it("shows a clear analyze error and clears busy state for invalid JSON responses", async () => {
    mockFetchWithHealth(invalidJsonResponse(false));
    const user = userEvent.setup();

    render(<HomePage />);
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/watch?v=1");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    expect(await screen.findByText("Failed to analyze video.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeEnabled();
  });

  it("rejects malformed format entries from analyze responses", async () => {
    mockFetchWithHealth(
      jsonResponse({
        ...analysisResult,
        formats: [
          {
            label: "1080p mp4 video",
            height: 1080,
            extension: "mp4",
            hasVideo: true,
            hasAudio: true,
            sizeBytes: 20971520
          }
        ]
      })
    );
    const user = userEvent.setup();

    render(<HomePage />);
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/watch?v=1");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    expect(await screen.findByText("Failed to analyze video.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "A very long demo video title" })).not.toBeInTheDocument();
    expect(screen.queryByText("1080p mp4 video")).not.toBeInTheDocument();
  });

  it("rejects analyze responses with negative format sizes", async () => {
    mockFetchWithHealth(
      jsonResponse({
        ...analysisResult,
        formats: [
          {
            ...analysisResult.formats[0],
            sizeBytes: -1048576
          }
        ]
      })
    );
    const user = userEvent.setup();

    render(<HomePage />);
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/watch?v=1");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    expect(await screen.findByText("Failed to analyze video.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "A very long demo video title" })).not.toBeInTheDocument();
    expect(screen.queryByText("-1 MB")).not.toBeInTheDocument();
  });

  it("shows an explicit message when analysis returns no formats", async () => {
    mockFetchWithHealth(
      jsonResponse({
        ...analysisResult,
        formats: []
      })
    );
    const user = userEvent.setup();

    render(<HomePage />);
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/watch?v=1");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    await screen.findByRole("heading", { name: "A very long demo video title" });
    const formatsPanel = screen.getByRole("heading", { name: "Formats" }).closest(".panel");

    expect(formatsPanel).not.toBeNull();
    expect(within(formatsPanel as HTMLElement).getByText("No downloadable formats found.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download selected format" })).toBeDisabled();
  });

  it("clears stale formats when the URL changes after analysis", async () => {
    mockFetchWithHealth(jsonResponse(analysisResult));
    const user = userEvent.setup();

    render(<HomePage />);
    const urlInput = screen.getByLabelText("Video URL");
    await user.type(urlInput, "https://example.com/watch?v=1");
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await screen.findByText("1080p mp4 video");

    await user.clear(urlInput);
    await user.type(urlInput, "https://example.com/watch?v=2");

    expect(screen.queryByRole("heading", { name: "A very long demo video title" })).not.toBeInTheDocument();
    expect(screen.queryByText("1080p mp4 video")).not.toBeInTheDocument();
    expect(screen.getByText("Analyze a URL to see available formats.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download selected format" })).toBeDisabled();
  });

  it("starts a download for the selected format", async () => {
    const fetchMock = mockFetchWithHealth(
      jsonResponse(analysisResult),
      jsonResponse({ jobId: "job-1", status: "queued" })
    );
    const user = userEvent.setup();

    render(<HomePage />);
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/watch?v=1");
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await screen.findByText("1080p mp4 video");
    await user.click(screen.getByRole("button", { name: "Download selected format" }));

    expect(await screen.findByText("queued · 0%")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/downloads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/watch?v=1",
        formatId: "137+bestaudio/137",
        title: "A very long demo video title",
        extension: "mp4"
      })
    });
  });

  it("shows immediate feedback while a download job is starting", async () => {
    const downloadResponse = deferred<Response>();
    const fetchMock = mockFetchWithHealth(jsonResponse(analysisResult));
    fetchMock.mockReturnValueOnce(downloadResponse.promise);
    const user = userEvent.setup();

    render(<HomePage />);
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/watch?v=1");
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await screen.findByText("1080p mp4 video");
    await user.click(screen.getByRole("button", { name: "Download selected format" }));

    expect(screen.getByRole("button", { name: "Starting download..." })).toBeDisabled();
    expect(screen.getByText("Starting download job...")).toBeInTheDocument();

    await act(async () => {
      downloadResponse.resolve(jsonResponse({ jobId: "job-1", status: "queued" }));
      await downloadResponse.promise;
    });

    expect(await screen.findByText("Download job started. Track progress in Downloads.")).toBeInTheDocument();
    expect(screen.getByText("queued · 0%")).toBeInTheDocument();
  });

  it("rejects terminal statuses from the start download response", async () => {
    mockFetchWithHealth(
      jsonResponse(analysisResult),
      jsonResponse({ jobId: "job-1", status: "completed" })
    );
    const user = userEvent.setup();

    render(<HomePage />);
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/watch?v=1");
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await screen.findByText("1080p mp4 video");
    await user.click(screen.getByRole("button", { name: "Download selected format" }));

    expect(await screen.findByText("Failed to start download.")).toBeInTheDocument();
    expect(screen.queryByText("completed · 0%")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Download file" })).not.toBeInTheDocument();
  });

  it("shows a clear download error and clears busy state when starting a download fails", async () => {
    const fetchMock = mockFetchWithHealth(jsonResponse(analysisResult));
    fetchMock.mockRejectedValueOnce(new Error("Network error"));
    const user = userEvent.setup();

    render(<HomePage />);
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/watch?v=1");
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    await screen.findByText("1080p mp4 video");
    await user.click(screen.getByRole("button", { name: "Download selected format" }));

    expect(await screen.findByText("Failed to start download.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download selected format" })).toBeEnabled();
  });

  it("disables analyze when yt-dlp is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        dependencies: [
          { name: "yt-dlp", available: false, error: "not found" },
          { name: "ffmpeg", available: true }
        ]
      })
    );
    const user = userEvent.setup();

    render(<HomePage />);
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/watch?v=1");

    expect(
      await screen.findByText("Missing dependency: yt-dlp. Install yt-dlp and ffmpeg to enable downloads.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
  });

  it("polls active downloads until completion and keeps terminal jobs idle", async () => {
    vi.useFakeTimers();
    const fetchMock = mockFetchWithHealth(
      jsonResponse(analysisResult),
      jsonResponse({ jobId: "job-1", status: "queued" }),
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
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.change(screen.getByLabelText("Video URL"), {
      target: { value: "https://example.com/watch?v=1" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("1080p mp4 video")).toBeInTheDocument();
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

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("marks active downloads failed when their status endpoint disappears", async () => {
    vi.useFakeTimers();
    const fetchMock = mockFetchWithHealth(
      jsonResponse(analysisResult),
      jsonResponse({ jobId: "job-1", status: "queued" }),
      jsonResponse({ error: "Download job not found." }, false)
    );

    render(<HomePage />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.change(screen.getByLabelText("Video URL"), {
      target: { value: "https://example.com/watch?v=1" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "Download selected format" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("queued · 0%")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByText("failed · 0%")).toBeInTheDocument();
    expect(screen.getByText("Download job not found.")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("marks active downloads failed when status refresh throws", async () => {
    vi.useFakeTimers();
    const fetchMock = mockFetchWithHealth(
      jsonResponse(analysisResult),
      jsonResponse({ jobId: "job-1", status: "queued" })
    );
    fetchMock.mockRejectedValueOnce(new Error("Network error"));

    render(<HomePage />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.change(screen.getByLabelText("Video URL"), {
      target: { value: "https://example.com/watch?v=1" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "Download selected format" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("queued · 0%")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByText("failed · 0%")).toBeInTheDocument();
    expect(screen.getByText("Failed to refresh download status.")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("marks active downloads failed when their status payload is malformed", async () => {
    vi.useFakeTimers();
    const fetchMock = mockFetchWithHealth(
      jsonResponse(analysisResult),
      jsonResponse({ jobId: "job-1", status: "queued" }),
      jsonResponse({ status: "running" })
    );

    render(<HomePage />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.change(screen.getByLabelText("Video URL"), {
      target: { value: "https://example.com/watch?v=1" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "Download selected format" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("queued · 0%")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByText("failed · 0%")).toBeInTheDocument();
    expect(screen.getByText("Failed to refresh download status.")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("marks active downloads failed when their status value is unknown", async () => {
    vi.useFakeTimers();
    const fetchMock = mockFetchWithHealth(
      jsonResponse(analysisResult),
      jsonResponse({ jobId: "job-1", status: "queued" }),
      jsonResponse({
        jobId: "job-1",
        status: "paused",
        progress: 50,
        title: "A very long demo video title",
        fileName: null,
        error: null
      })
    );

    render(<HomePage />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.change(screen.getByLabelText("Video URL"), {
      target: { value: "https://example.com/watch?v=1" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "Download selected format" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("queued · 0%")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByText("failed · 0%")).toBeInTheDocument();
    expect(screen.getByText("Failed to refresh download status.")).toBeInTheDocument();
    expect(screen.queryByText("paused · 50%")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("marks active downloads failed when their progress is outside the valid range", async () => {
    vi.useFakeTimers();
    const fetchMock = mockFetchWithHealth(
      jsonResponse(analysisResult),
      jsonResponse({ jobId: "job-1", status: "queued" }),
      jsonResponse({
        jobId: "job-1",
        status: "running",
        progress: 150,
        title: "A very long demo video title",
        fileName: null,
        error: null
      })
    );

    render(<HomePage />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.change(screen.getByLabelText("Video URL"), {
      target: { value: "https://example.com/watch?v=1" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "Download selected format" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("queued · 0%")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByText("failed · 0%")).toBeInTheDocument();
    expect(screen.getByText("Failed to refresh download status.")).toBeInTheDocument();
    expect(screen.queryByText("running · 150%")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
