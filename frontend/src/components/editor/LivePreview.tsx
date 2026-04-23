"use client";

import { useMemo } from "react";

interface LivePreviewProps {
  html: string;
  css: string;
  javascript: string;
}

export default function LivePreview({ html, css, javascript }: LivePreviewProps) {
  const srcdoc = useMemo(() => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    /* Reset */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    /* User styles */
    ${css}
  </style>
</head>
<body>
  ${html}
  <script>
    // Error handling wrapper
    (function() {
      try {
        ${javascript}
      } catch (err) {
        var errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position:fixed;bottom:0;left:0;right:0;padding:12px 16px;background:#1e1e1e;color:#f87171;font-family:monospace;font-size:13px;border-top:2px solid #ef4444;z-index:9999;white-space:pre-wrap;';
        errorDiv.textContent = '\\u26A0 Runtime Error: ' + err.message;
        document.body.appendChild(errorDiv);
      }
    })();
  </script>
</body>
</html>`;
  }, [html, css, javascript]);

  return (
    <div className="h-full w-full overflow-hidden bg-white">
      <iframe
        srcDoc={srcdoc}
        title="Live Preview"
        sandbox="allow-scripts allow-modals"
        className="h-full w-full border-0"
      />
    </div>
  );
}
