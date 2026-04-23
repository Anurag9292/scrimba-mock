import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/link to render a plain <a> tag so we can test href attributes
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: any;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock ScrimList to avoid API calls in unit tests
vi.mock("@/components/scrim/ScrimList", () => ({
  default: () => <div data-testid="scrim-list">Scrim list placeholder</div>,
}));

// Mock AuthNav to avoid requiring AuthProvider in unit tests
vi.mock("@/components/auth/AuthNav", () => ({
  default: () => <div data-testid="auth-nav">Auth nav placeholder</div>,
}));

import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the ScrimbaClone heading", () => {
    render(<HomePage />);
    expect(screen.getByText("ScrimbaClone")).toBeInTheDocument();
  });

  it("has navigation links", () => {
    render(<HomePage />);
    // Navbar should have the ScrimbaClone brand link and AuthNav
    expect(screen.getByText("ScrimbaClone")).toBeInTheDocument();
    expect(screen.getByTestId("auth-nav")).toBeInTheDocument();
  });

  it("has link to /record page", () => {
    render(<HomePage />);
    const recordLinks = screen.getAllByRole("link").filter(
      (link) => link.getAttribute("href") === "/record"
    );
    expect(recordLinks.length).toBeGreaterThan(0);
  });

  it("renders the hero section with tagline", () => {
    render(<HomePage />);
    expect(screen.getByText("Code. Record.")).toBeInTheDocument();
    expect(screen.getByText("Teach interactively.")).toBeInTheDocument();
  });

  it("has a Start Recording button linking to /record", () => {
    render(<HomePage />);
    const startRecordingLink = screen.getByText("Start Recording").closest("a");
    expect(startRecordingLink).toHaveAttribute("href", "/record");
  });

  it("has a Browse Scrims button linking to #scrims", () => {
    render(<HomePage />);
    const browseScrimsLink = screen.getByText("Browse Scrims").closest("a");
    expect(browseScrimsLink).toHaveAttribute("href", "#scrims");
  });

  it("renders feature cards", () => {
    render(<HomePage />);
    expect(screen.getByText("Recording Studio")).toBeInTheDocument();
    expect(screen.getByText("Interactive Player")).toBeInTheDocument();
  });

  it("renders the footer", () => {
    render(<HomePage />);
    // The footer uses &mdash; which renders as an em dash
    expect(
      screen.getByText(/ScrimbaClone.*Interactive code screencasts/)
    ).toBeInTheDocument();
  });
});
