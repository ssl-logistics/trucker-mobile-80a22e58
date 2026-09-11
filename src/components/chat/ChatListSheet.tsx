import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MockChatItem {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
}

const MOCK_CHATS: MockChatItem[] = [
  {
    id: "mock-1",
    name: "บริษัท ขนส่ง A",
    lastMessage: "งาน OR20260911001 รบกวนยืนยันเวลารับสินค้าครับ",
    time: "10:24",
    unread: 2,
  },
  {
    id: "mock-2",
    name: "โรงงาน B",
    lastMessage: "เอกสาร EIR ได้รับแล้ว ขอบคุณครับ",
    time: "09:15",
    unread: 0,
  },
  {
    id: "mock-3",
    name: "แอดมินตลาด",
    lastMessage: "มีงานใหม่ในตลาดที่ตรงกับรถของคุณ",
    time: "เมื่อวาน",
    unread: 1,
  },
  {
    id: "mock-4",
    name: "บริษัท โลจิสติกส์ C",
    lastMessage: "จุดส่งสินค้ามีการเปลี่ยนแปลงเล็กน้อย",
    time: "เมื่อวาน",
    unread: 0,
  },
  {
    id: "mock-5",
    name: "ฝ่ายจัดงาน",
    lastMessage: "ยืนยันการปิดงานเรียบร้อยแล้วครับ",
    time: "2 วันที่แล้ว",
    unread: 0,
  },
];

interface ChatListSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatListSheet({ open, onOpenChange }: ChatListSheetProps) {
  const { toast } = useToast();

  const handleItemClick = () => {
    toast({ description: "ฟีเจอร์แชทจะเปิดให้ใช้งานเร็วๆ นี้" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[360px] w-[92%] h-[480px] flex flex-col p-0 gap-0 rounded-2xl border-0 overflow-hidden [&>button]:hidden">
        <DialogHeader className="px-4 py-3 flex-shrink-0 bg-secondary relative">
          <DialogTitle className="flex items-center gap-2 text-base text-white">
            <MessageCircle className="w-5 h-5 text-white" />
            แชท
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="divide-y divide-border">
            {MOCK_CHATS.map((chat) => (
              <button
                key={chat.id}
                onClick={handleItemClick}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
              >
                <Avatar className="w-11 h-11 flex-shrink-0">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-secondary/10 text-secondary text-sm font-semibold">
                    {chat.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-sm text-foreground truncate">{chat.name}</h3>
                    <span className="text-[11px] text-muted-foreground flex-shrink-0">{chat.time}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground truncate">{chat.lastMessage}</p>
                    {chat.unread > 0 && (
                      <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-secondary text-white text-[10px] font-semibold flex items-center justify-center">
                        {chat.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

      </DialogContent>
    </Dialog>
  );
}
