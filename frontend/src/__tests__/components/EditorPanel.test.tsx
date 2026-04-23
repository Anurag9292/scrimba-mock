import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@monaco-editor/react", () => ({
  default: (props: any) => (
    <div
      data-testid="mock-monaco-editor"
      data-language={props.language}
      data-value={props.value}
    >
      Mock Editor
    </div>
  ),
}));

import EditorPanel from "@/components/editor/EditorPanel";

describe("EditorPanel", () => {
  it("renders tabs for all default files (index.html, styles.css, script.js)", () => {
    render(<EditorPanel />);
    expect(screen.getByText("index.html")).toBeInTheDocument();
    expect(screen.getByText("styles.css")).toBeInTheDocument();
    expect(screen.getByText("script.js")).toBeInTheDocument();
  });

  it("default active tab is index.html", () => {
    const { container } = render(<EditorPanel />);
    // The first tab (index.html) should have active styling
    const buttons = container.querySelectorAll("button");
    const htmlButton = Array.from(buttons).find((btn) =>
      btn.textContent?.includes("index.html")
    );
    expect(htmlButton?.className).toContain("bg-[#1e1e1e]");
    expect(htmlButton?.className).toContain("text-white");

    // The editor should show HTML language
    const editor = screen.getByTestId("mock-monaco-editor");
    expect(editor).toHaveAttribute("data-language", "html");
  });

  it("switching tabs changes the active file", () => {
    const { container } = render(<EditorPanel />);

    // Click on styles.css tab
    fireEvent.click(screen.getByText("styles.css"));

    // styles.css button should now have active styling
    const buttons = container.querySelectorAll("button");
    const cssButton = Array.from(buttons).find((btn) =>
      btn.textContent?.includes("styles.css")
    );
    expect(cssButton?.className).toContain("bg-[#1e1e1e]");
    expect(cssButton?.className).toContain("text-white");

    // The editor should now show CSS language
    const editor = screen.getByTestId("mock-monaco-editor");
    expect(editor).toHaveAttribute("data-language", "css");
  });

  it("switching to script.js shows javascript language", () => {
    render(<EditorPanel />);

    fireEvent.click(screen.getByText("script.js"));

    const editor = screen.getByTestId("mock-monaco-editor");
    expect(editor).toHaveAttribute("data-language", "javascript");
  });

  it("renders the Monaco editor", () => {
    render(<EditorPanel />);
    expect(screen.getByTestId("mock-monaco-editor")).toBeInTheDocument();
  });

  it("calls onFilesChange when files change", () => {
    const handleFilesChange = vi.fn();
    render(<EditorPanel onFilesChange={handleFilesChange} />);
    // onFilesChange is called via useEffect on initial render
    expect(handleFilesChange).toHaveBeenCalled();
  });
});
