import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("renders the URL form and format area", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Video Downloader" })).toBeInTheDocument();
    expect(screen.getByLabelText("Video URL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeInTheDocument();
    expect(screen.getByText("Formats")).toBeInTheDocument();
    expect(screen.getByText("Downloads")).toBeInTheDocument();
  });
});
