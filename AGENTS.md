# Project Architecture Rules

- Keep current-job queue visibility data-driven through optional job queue fields, so later API conditions can replace placeholders without changing card UI.- QTruck integration goes through edge functions get-qtruck-queue (read) and qtruck-webhook (inbound, x-api-key = QTRUCK_API_KEY); queue alerts are notifications with notification_type 'qtruck_queue' shown by a global popup — keeps the key server-side and reuses the notification pipeline.
