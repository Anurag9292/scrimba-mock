import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LivePreview from "@/components/editor/LivePreview";

describe("LivePreview", () => {
  const defaultProps = {
    html: "<h1>Hello</h1>",
    css: "h1 { color: red; }",
    javascript: 'console.log("hi");',
  };

  it("renders an iframe element", () => {
    render(<LivePreview {...defaultProps} />);
    const iframe = screen.getByTitle("Live Preview");
    expect(iframe).toBeInTheDocument();
    expect(iframe.tagName).toBe("IFRAME");
  });

  it('iframe has correct sandbox attribute', () => {
    render(<LivePreview {...defaultProps} />);
    const iframe = screen.getByTitle("Live Preview");
    expect(iframe).toHaveAttribute("sandbox", "allow-scripts allow-modals allow-same-origin");
  });

  it("generates correct srcdoc combining HTML, CSS, and JS", () => {
    render(<LivePreview {...defaultProps} />);
    const iframe = screen.getByTitle("Live Preview") as HTMLIFrameElement;
    const srcdoc = iframe.getAttribute("srcdoc") ?? "";

    // Should contain the HTML content
    expect(srcdoc).toContain("<h1>Hello</h1>");
    // Should contain the CSS inside a <style> tag
    expect(srcdoc).toContain("h1 { color: red; }");
    // Should contain the JS inside a <script> tag
    expect(srcdoc).toContain('console.log("hi");');
    // Should have the basic HTML structure
    expect(srcdoc).toContain("<!DOCTYPE html>");
    expect(srcdoc).toContain("<html");
    expect(srcdoc).toContain("</html>");
  });

  it("wraps JS in try-catch for error handling", () => {
    render(<LivePreview {...defaultProps} />);
    const iframe = screen.getByTitle("Live Preview") as HTMLIFrameElement;
    const srcdoc = iframe.getAttribute("srcdoc") ?? "";

    expect(srcdoc).toContain("try {");
    expect(srcdoc).toContain("} catch (err) {");
    expect(srcdoc).toContain("Runtime Error");
  });
});
