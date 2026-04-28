import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("renders the initial product heading", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Video Downloader" })).toBeInTheDocument();
    expect(screen.getByText("Paste a public Bilibili or YouTube URL to inspect formats.")).toBeInTheDocument();
  });
});
