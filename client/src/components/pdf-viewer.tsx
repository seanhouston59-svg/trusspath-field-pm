import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
// Vite resolves the worker as a URL asset; works in dev and after build/deploy.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Renders an actual PDF to <canvas> using PDF.js — works in every browser
 * (no dependency on a native PDF plugin) and is screenshot/QA-able.
 */
export function PdfViewer({ url, className }: { url: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    setLoading(true);
    setError(false);

    pdfjsLib.getDocument(url).promise
      .then(async (pdf) => {
        if (cancelled) return;
        const width = Math.max(320, container.clientWidth - 24);
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = width / base.width;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "mb-2 w-full rounded-sm bg-white";
          canvas.style.boxShadow = "0 1px 4px rgba(0,0,0,0.18)";
          container.appendChild(canvas);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport } as any).promise;
          }
        }
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className={`${className ?? ""} overflow-auto bg-muted/40`}>
      {loading && <div className="p-4 text-sm text-muted-foreground">Loading PDF…</div>}
      {error && <div className="p-4 text-sm text-muted-foreground">Could not load this PDF.</div>}
      <div ref={containerRef} className="mx-auto w-full max-w-3xl p-3" />
    </div>
  );
}
