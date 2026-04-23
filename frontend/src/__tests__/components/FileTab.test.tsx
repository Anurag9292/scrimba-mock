import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FileTab from "@/components/editor/FileTab";

describe("FileTab", () => {
  it("renders the filename correctly", () => {
    render(
      <FileTab filename="index.html" isActive={false} onClick={() => {}} />
    );
    expect(screen.getByText("index.html")).toBeInTheDocument();
  });

  it("shows correct color dot for HTML files (orange)", () => {
    const { container } = render(
      <FileTab filename="index.html" isActive={false} onClick={() => {}} />
    );
    const dot = container.querySelector("span.bg-orange-400");
    expect(dot).toBeInTheDocument();
  });

  it("shows correct color dot for CSS files (blue)", () => {
    const { container } = render(
      <FileTab filename="styles.css" isActive={false} onClick={() => {}} />
    );
    const dot = container.querySelector("span.bg-blue-400");
    expect(dot).toBeInTheDocument();
  });

  it("shows correct color dot for JS files (yellow)", () => {
    const { container } = render(
      <FileTab filename="script.js" isActive={false} onClick={() => {}} />
    );
    const dot = container.querySelector("span.bg-yellow-400");
    expect(dot).toBeInTheDocument();
  });

  it("active tab has correct styling (brighter bg, border highlight)", () => {
    const { container } = render(
      <FileTab filename="index.html" isActive={true} onClick={() => {}} />
    );
    const button = container.querySelector("button");
    expect(button?.className).toContain("bg-[#1e1e1e]");
    expect(button?.className).toContain("text-white");
    // Active tab should have the bottom highlight span
    const highlight = container.querySelector("span.bg-brand-500");
    expect(highlight).toBeInTheDocument();
  });

  it("inactive tab does not have active styling", () => {
    const { container } = render(
      <FileTab filename="index.html" isActive={false} onClick={() => {}} />
    );
    const button = container.querySelector("button");
    expect(button?.className).toContain("bg-gray-900/40");
    expect(button?.className).toContain("text-gray-500");
    // Should not have the bottom highlight span
    const highlight = container.querySelector("span.bg-brand-500");
    expect(highlight).not.toBeInTheDocument();
  });

  it("clicking tab calls onClick handler", () => {
    const handleClick = vi.fn();
    render(
      <FileTab filename="index.html" isActive={false} onClick={handleClick} />
    );
    fireEvent.click(screen.getByText("index.html"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
