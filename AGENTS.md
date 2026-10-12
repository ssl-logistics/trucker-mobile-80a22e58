# Project Architecture Rules

- Keep current-job queue visibility data-driven through optional job queue fields, so later API conditions can replace placeholders without changing card UI.- QTruck integration goes through edge functions get-qtruck-queue (read) and qtruck-webhook (inbound, x-api-key = QTRUCK_API_KEY); queue alerts are notifications with notification_type 'qtruck_queue' shown by a global popup — keeps the key server-side and reuses the notification pipeline.
- Preview/test detection: always use `isPreviewHost()` from `src/utils/previewHost.ts` (covers id-preview--, *.lovable.app, localhost); never inline hostname checks — intro cards and test-only behaviors must behave identically on every Lovable link.
- Keep the startup splash as an overlay above the mounted application, so authentication, route data, and tab preloads run during its fixed display time instead of waiting for it to finish.

- Verify CDN asset pointers (`src/assets/*.asset.json`) in Playwright by routing `**/__l5e/**` to the local file, because the raw sandbox dev server answers that path with the SPA fallback (text/html) while the preview and published hosts serve the real bytes — a blank image locally is a serving artifact, not a broken asset.
