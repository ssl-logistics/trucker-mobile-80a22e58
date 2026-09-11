import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, X, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getFreelanceAcceptedJobs } from "@/lib/externalApi";
import { fetchTaladThreads, TaladThread } from "@/lib/taladChat";
import { TaladChatRoom } from "./TaladChatRoom";

interface ChatListSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface JobRef {
  jobId: string;
  title: string;
}

function resolveTaladJobId(job: any): string | null {
  const id =
    job?.talad_job_id ||
    job?.job_id ||
    job?.post_id ||
    job?.ticket_id ||
    job?.id;
  return id ? String(id) : null;
}

function jobTitle(job: any): string {
  return (
    job?.order_number ||
    job?.order_code ||
    job?.title ||
    job?.product_type ||
    "งานขนส่ง"
  );
}

function formatTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" });
}

export function ChatListSheet({ open, onOpenChange }: ChatListSheetProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [threads, setThreads] = useState<TaladThread[]>([]);
  const [jobRefs, setJobRefs] = useState<Record<string, string>>({});
  const [activeJob, setActiveJob] = useState<JobRef | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data } = await getFreelanceAcceptedJobs(user.id, 50);
      const jobs: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];
      const titles: Record<string, string> = {};
      const ids: string[] = [];
      for (const job of jobs) {
        const id = resolveTaladJobId(job);
        if (!id || titles[id]) continue;
        titles[id] = jobTitle(job);
        ids.push(id);
      }
      setJobRefs(titles);
      const result = ids.length ? await fetchTaladThreads(ids.slice(0, 20), user.id) : [];
      setThreads(result.filter((t) => t.message_count > 0));
    } catch (e) {
      console.error("[ChatListSheet] load error", e);
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (open && !activeJob) load();
  }, [open, activeJob, load]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setActiveJob(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[360px] w-[92%] h-[480px] flex flex-col p-0 gap-0 rounded-2xl border-0 overflow-hidden [&>button]:hidden">
        {activeJob ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>{activeJob.title}</DialogTitle>
            </DialogHeader>
            <TaladChatRoom
              jobId={activeJob.jobId}
              title={activeJob.title}
              driverId={user?.id}
              senderName={(user as any)?.full_name || (user as any)?.name}
              onBack={() => setActiveJob(null)}
            />
          </>
        ) : (
          <>
            <DialogHeader className="px-4 py-3 flex-shrink-0 bg-secondary relative">
              <DialogTitle className="flex items-center gap-2 text-base text-white">
                <MessageCircle className="w-5 h-5 text-white" />
                แชท
              </DialogTitle>
              <button
                onClick={() => handleOpenChange(false)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </DialogHeader>

            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : threads.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-10 px-6">
                  ยังไม่มีข้อความจากตลาดสำหรับงานที่คุณรับไว้
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {threads.map((thread) => {
                    const title = jobRefs[thread.job_id] || thread.job_title || "งานขนส่ง";
                    return (
                      <button
                        key={thread.job_id}
                        onClick={() => setActiveJob({ jobId: thread.job_id, title })}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        <Avatar className="w-11 h-11 flex-shrink-0">
                          <AvatarFallback className="bg-secondary/10 text-secondary text-sm font-semibold">
                            {title[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold text-sm text-foreground truncate">{title}</h3>
                            <span className="text-[11px] text-muted-foreground flex-shrink-0">
                              {formatTime(thread.last_message?.created_at)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p className="text-xs text-muted-foreground truncate">
                              {thread.last_message?.message || "ยังไม่มีข้อความ"}
                            </p>
                            {thread.unread > 0 && (
                              <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-secondary text-white text-[10px] font-semibold flex items-center justify-center">
                                {thread.unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
