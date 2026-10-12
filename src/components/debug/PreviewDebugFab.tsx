import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bug, X, RefreshCw } from "lucide-react";
import { isPreviewHost } from "@/utils/previewHost";

interface IntroCheck {
  label: string;
  ackKey: string;
  note?: string;
}

const INTRO_CARDS: IntroCheck[] = [
  { label: "แจ้งซ่อม (หน้าตั้งค่า)", ackKey: "repair_menu_intro_ack" },
  { label: "เอกสาร (หน้ารายละเอียดงาน)", ackKey: "documents_menu_intro_ack" },
  { label: "ดูคิว (หน้างานปัจจุบัน)", ackKey: "queue_button_intro_ack", note: "ต้องมีงานในลิสต์" },
  { label: "สำรองจ่าย (หน้าเพิ่มค่าใช้จ่าย)", ackKey: "advance_payment_intro_ack" },
  { label: "เลขไมล์/น้ำมัน (หน้าเพิ่มค่าใช้จ่าย)", ackKey: "fuel_details_intro_ack" },
  { label: "ลายเซ็น (หน้าต่างเซ็นชื่อ)", ackKey: "signature_intro_ack" },
];

/**
 * Floating debug icon for preview hosts only. Shows why each intro card
 * would/wouldn't render for the current account. Never renders on production
 * (custom domains) — isPreviewHost() gates the whole component.
 */
export const PreviewDebugFab = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);

  // Re-read localStorage whenever the panel opens or the route changes
  useEffect(() => {
    if (open) setTick((t) => t + 1);
  }, [open, location.pathname]);

  if (!isPreviewHost()) return null;

  const driverId = localStorage.getItem("auth_driver_id") || "(ไม่มี)";
  const route = location.pathname;

  const rows = INTRO_CARDS.map((card) => {
    const key = card.ackKey + ":" + driverId;
    const acked = driverId !== "(ไม่มี)" && localStorage.getItem(key) === "1";
    // On preview hosts cards always show regardless of ack
    const verdict = "แสดง (preview แสดงทุกครั้ง)";
    return { ...card, acked, verdict };
  });

  return (
    <>
      <button
        aria-label="debug"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-24 right-3 z-[9999] w-10 h-10 rounded-full bg-foreground/80 text-background flex items-center justify-center shadow-lg"
      >
        <Bug className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed inset-x-3 bottom-36 z-[9999] max-h-[60vh] overflow-auto rounded-xl border bg-card p-4 shadow-2xl text-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold">Debug: การ์ดแนะนำเมนู</p>
            <div className="flex gap-1">
              <button aria-label="refresh" onClick={() => setTick((t) => t + 1)} className="p-1">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button aria-label="close" onClick={() => setOpen(false)} className="p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-1 mb-3 text-xs">
            <p>previewHost: <b>true</b></p>
            <p>host: {window.location.hostname}</p>
            <p>route: {route}</p>
            <p>บัญชี: {driverId}</p>
          </div>

          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.ackKey} className="rounded-lg border p-2 text-xs">
                <p className="font-medium">{r.label}</p>
                <p className="text-muted-foreground">
                  ack ในเครื่อง: {r.acked ? "กดรับทราบแล้ว" : "ยังไม่เคยกด"} → {r.verdict}
                  {r.note ? ` (${r.note})` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
