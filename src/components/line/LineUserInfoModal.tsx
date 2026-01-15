import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, MessageSquare, Mail, Hash, CheckCircle } from 'lucide-react';

interface LineUserData {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  email?: string;
}

interface LineUserInfoModalProps {
  open: boolean;
  onClose: () => void;
  userData: LineUserData | null;
}

export const LineUserInfoModal = ({ open, onClose, userData }: LineUserInfoModalProps) => {
  if (!userData) return null;

  const infoRows = [
    {
      icon: Hash,
      label: 'LINE User ID',
      value: userData.lineUserId,
    },
    {
      icon: User,
      label: 'Display Name',
      value: userData.displayName,
    },
    {
      icon: MessageSquare,
      label: 'Status Message',
      value: userData.statusMessage || '-',
    },
    {
      icon: Mail,
      label: 'Email',
      value: userData.email || '-',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm mx-auto rounded-2xl">
        <DialogHeader className="text-center space-y-4">
          {/* Success Icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-[#00B900]/10 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-[#00B900]" />
          </div>
          
          <DialogTitle className="text-xl">เข้าสู่ระบบ LINE สำเร็จ!</DialogTitle>
          <DialogDescription>
            ข้อมูลที่ได้รับจาก LINE
          </DialogDescription>
        </DialogHeader>

        {/* User Profile */}
        <div className="flex flex-col items-center py-4">
          <Avatar className="w-20 h-20 border-4 border-[#00B900]/20">
            <AvatarImage src={userData.pictureUrl} alt={userData.displayName} />
            <AvatarFallback className="bg-[#00B900]/10 text-[#00B900] text-xl font-bold">
              {userData.displayName?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <h3 className="mt-3 text-lg font-semibold">{userData.displayName}</h3>
          <Badge variant="secondary" className="mt-1 bg-[#00B900]/10 text-[#00B900]">
            LINE User
          </Badge>
        </div>

        {/* Info Details */}
        <ScrollArea className="max-h-[200px]">
          <div className="space-y-3 px-1">
            {infoRows.map((row) => (
              <div 
                key={row.label}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <row.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{row.label}</p>
                  <p className="text-sm font-medium break-all">{row.value}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Picture URL (if exists) */}
        {userData.pictureUrl && (
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Picture URL</p>
            <p className="text-xs break-all text-primary">{userData.pictureUrl}</p>
          </div>
        )}

        <DialogFooter>
          <Button 
            onClick={onClose}
            className="w-full bg-[#00B900] hover:bg-[#00A000] text-white"
          >
            ดำเนินการต่อ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
