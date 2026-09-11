import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { fetchTaladMessages, sendTaladMessage, TaladMessage } from "@/lib/taladChat";

interface TaladChatRoomProps {
  jobId: string;
  title: string;
  driverId?: string;
  senderName?: string;
  onBack: () => void;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export function TaladChatRoom({ jobId, title, driverId, senderName, onBack }: TaladChatRoomProps) {
  const [messages, setMessages] = useState<TaladMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const load = async (initial = false) => {
      if (initial) setLoading(true);
      const list = await fetchTaladMessages(jobId, driverId);
      if (!active) return;
      setMessages(list);
      if (initial) setLoading(false);
    };
    load(true);
    const timer = setInterval(() => load(false), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [jobId, driverId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const handleSend = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setText("");
    const res = await sendTaladMessage({ jobId, message: value, driverId, senderName });
    if (!res?.ok) {
      toast({ description: "ส่งข้อความไม่สำเร็จ กรุณาลองใหม่", variant: "destructive" });
      setText(value);
    } else {
      setMessages((prev) => [...prev, res.message]);
      if (!res.delivered) {
        toast({ description: "ส่งแล้ว แต่ฝั่งตลาดยังไม่พร้อมรับข้อความ" });
      }
    }
    setSending(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-3 bg-secondary flex-shrink-0">
        <button onClick={onBack} className="text-white/80 hover:text-white" aria-label="ย้อนกลับ">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-semibold text-white truncate">{title}</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">ยังไม่มีข้อความ</p>
          ) : (
            messages.map((m) => {
              const mine =
                m.direction === "to_marketplace" ||
                m.direction === "from_partner" ||
                (!!driverId && m.sender_id === driverId);
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                      mine ? "bg-secondary text-white" : "bg-muted text-foreground"
                    }`}
                  >
                    {!mine && (
                      <p className="text-[10px] opacity-70 mb-0.5">{m.sender_name}</p>
                    )}
                    {m.image_url && (
                      <img
                        src={m.image_url}
                        alt="รูปในแชท"
                        loading="lazy"
                        className="rounded-lg mb-1 max-h-40 object-cover"
                      />
                    )}
                    {m.message && <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>}
                    <p className="text-[10px] opacity-70 text-right mt-0.5">{formatTime(m.created_at)}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 p-2 border-t border-border flex-shrink-0">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="พิมพ์ข้อความ..."
          className="flex-1 h-10 text-sm"
        />
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="w-10 h-10 rounded-full bg-secondary text-white flex items-center justify-center disabled:opacity-50"
          aria-label="ส่งข้อความ"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
