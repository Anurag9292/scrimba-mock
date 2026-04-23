import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@monaco-editor/react", () => ({
  default: (props: any) => (
    <div
      data-testid="mock-monaco-editor"
      data-language={props.language}
      data-value={props.value}
      data-theme={props.theme}
      data-readonly={props.options?.readOnly?.toString()}
      data-minimap={props.options?.minimap?.enabled?.toString()}
      data-fontsize={props.options?.fontSize?.toString()}
    >
      {props.loading}
    </div>
  ),
}));

import CodeEditor from "@/components/editor/CodeEditor";

describe("CodeEditor", () => {
  const defaultProps = {
    value: "const x = 1;",
    language: "javascript",
    onChange: vi.fn(),
  };

  it("renders without crashing", () => {
    render(<CodeEditor {...defaultProps} />);
    const editor = screen.getByTestId("mock-monaco-editor");
    expect(editor).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    render(<CodeEditor {...defaultProps} />);
    expect(screen.getByText("Loading editor...")).toBeInTheDocument();
  });

  it("passes correct language to Monaco", () => {
    render(<CodeEditor {...defaultProps} />);
    const editor = screen.getByTestId("mock-monaco-editor");
    expect(editor).toHaveAttribute("data-language", "javascript");
  });

  it("passes correct value to Monaco", () => {
    render(<CodeEditor {...defaultProps} />);
    const editor = screen.getByTestId("mock-monaco-editor");
    expect(editor).toHaveAttribute("data-value", "const x = 1;");
  });

  it("passes correct theme to Monaco", () => {
    render(<CodeEditor {...defaultProps} />);
    const editor = screen.getByTestId("mock-monaco-editor");
    expect(editor).toHaveAttribute("data-theme", "vs-dark");
  });

  it("passes correct options to Monaco", () => {
    render(<CodeEditor {...defaultProps} />);
    const editor = screen.getByTestId("mock-monaco-editor");
    expect(editor).toHaveAttribute("data-readonly", "false");
    expect(editor).toHaveAttribute("data-minimap", "false");
    expect(editor).toHaveAttribute("data-fontsize", "14");
  });

  it("passes readOnly option when set", () => {
    render(<CodeEditor {...defaultProps} readOnly={true} />);
    const editor = screen.getByTestId("mock-monaco-editor");
    expect(editor).toHaveAttribute("data-readonly", "true");
  });
});
