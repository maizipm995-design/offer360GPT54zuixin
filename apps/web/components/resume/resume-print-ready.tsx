'use client';

import { useEffect } from 'react';
import type { ResumePreviewMetrics } from './resume-types';

declare global {
  interface Window {
    __RESUME_PRINT_READY__?: boolean;
    __RESUME_PRINT_METRICS__?: ResumePreviewMetrics | null;
  }
}

export function ResumePrintReady() {
  useEffect(() => {
    let cancelled = false;

    const markReady = async () => {
      window.__RESUME_PRINT_READY__ = false;

      const fontSet = (document as Document & { fonts?: FontFaceSet }).fonts;
      if (fontSet?.ready) {
        await fontSet.ready.catch(() => undefined);
      }

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      if (cancelled) {
        return;
      }

      const contentElement = document.querySelector('[data-resume-content]') as HTMLElement | null;
      const metrics = contentElement
        ? {
            availableHeight: contentElement.clientHeight,
            contentHeight: contentElement.scrollHeight,
            overflowHeight: Math.max(contentElement.scrollHeight - contentElement.clientHeight, 0),
            pageCount: Math.max(1, Math.ceil(contentElement.scrollHeight / Math.max(contentElement.clientHeight, 1))),
          }
        : null;

      window.__RESUME_PRINT_METRICS__ = metrics;
      window.__RESUME_PRINT_READY__ = true;
    };

    void markReady();

    return () => {
      cancelled = true;
      window.__RESUME_PRINT_READY__ = false;
      window.__RESUME_PRINT_METRICS__ = null;
    };
  }, []);

  return null;
}
