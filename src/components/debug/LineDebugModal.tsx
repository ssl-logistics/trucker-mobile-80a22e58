import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Capacitor } from '@capacitor/core';
import { Copy, Trash2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LineDebugModalProps {
  open: boolean;
  onClose: () => void;
}

interface DebugInfo {
  userAgent: string;
  platform: string;
  isNative: boolean;
  origin: string;
  href: string;
  lineOAuthStateLocal: string | null;
  lineOAuthStateSession: string | null;
  lastCallbackUrl: string | null;
  lastCallbackParams: string | null;
  lastDeepLinkUrl: string | null;
  lastDeepLinkSource: string | null;
  lastDeepLinkAt: string | null;
  lastDeepLinkError: string | null;
  authLoginType: string | null;
  authDriverId: string | null;
  hasAuthDriver: boolean;
  hasAppPrefixInState: boolean;
  hasAppPrefixInSavedState: boolean;
}

const collectDebugInfo = (): DebugInfo => {
  const lineOAuthStateLocal = localStorage.getItem('line_oauth_state');
  const lineOAuthStateSession = sessionStorage.getItem('line_oauth_state');
  const lastCallbackParams = localStorage.getItem('line_last_callback_params');

  let stateFromUrl: string | null = null;
  try {
    if (lastCallbackParams) {
      stateFromUrl = JSON.parse(lastCallbackParams).state || null;
    }
  } catch {
    // ignore
  }

  return {
    userAgent: navigator.userAgent,
    platform: Capacitor.getPlatform(),
    isNative: Capacitor.isNativePlatform(),
    origin: window.location.origin,
    href: window.location.href,
    lineOAuthStateLocal,
    lineOAuthStateSession,
    lastCallbackUrl: localStorage.getItem('line_last_callback_url'),
    lastCallbackParams,
    lastDeepLinkUrl: localStorage.getItem('line_last_deep_link_url'),
    lastDeepLinkSource: localStorage.getItem('line_last_deep_link_source'),
    lastDeepLinkAt: localStorage.getItem('line_last_deep_link_at'),
    lastDeepLinkError: localStorage.getItem('line_last_deep_link_error'),
    authLoginType: localStorage.getItem('auth_login_type'),
    authDriverId: localStorage.getItem('auth_driver_id'),
    hasAuthDriver: !!localStorage.getItem('auth_driver'),
    hasAppPrefixInState: !!stateFromUrl?.startsWith('thetroob_'),
    hasAppPrefixInSavedState:
      !!lineOAuthStateLocal?.startsWith('thetroob_') ||
      !!lineOAuthStateSession?.startsWith('thetroob_'),
  };
};

export const LineDebugModal = ({ open, onClose }: LineDebugModalProps) => {
  const { toast } = useToast();
  const [info, setInfo] = useState<DebugInfo | null>(null);

  useEffect(() => {
    if (open) {
      setInfo(collectDebugInfo());
    }
  }, [open]);

  const refresh = () => {
    setInfo(collectDebugInfo());
    toast({ title: 'รีเฟรชข้อมูลแล้ว' });
  };

  const clearLineDebug = () => {
    localStorage.removeItem('line_last_callback_url');
    localStorage.removeItem('line_last_callback_params');
    localStorage.removeItem('line_last_deep_link_url');
    localStorage.removeItem('line_last_deep_link_source');
    localStorage.removeItem('line_last_deep_link_at');
    localStorage.removeItem('line_last_deep_link_error');
    localStorage.removeItem('line_oauth_state');
    sessionStorage.removeItem('line_oauth_state');
    setInfo(collectDebugInfo());
    toast({ title: 'ล้างข้อมูล Debug แล้ว' });
  };

  const copyAll = async () => {
    if (!info) return;
    const text = JSON.stringify(info, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'คัดลอกข้อมูลแล้ว', description: 'วางลงในแชทเพื่อส่งให้ทีม' });
    } catch {
      toast({ variant: 'destructive', title: 'คัดลอกไม่สำเร็จ' });
    }
  };

  if (!info) return null;

  const diagnoses: Array<{ label: string; status: 'ok' | 'warn' | 'fail'; message: string }> = [];

  if (!info.lastCallbackUrl && !info.lastDeepLinkUrl) {
    diagnoses.push({
      label: 'LINE Callback',
      status: 'warn',
      message: 'ยังไม่เคยมีการ callback จาก LINE บนเครื่องนี้ — ลอง login LINE ก่อน',
    });
  } else if (info.lastDeepLinkUrl && !info.lastCallbackUrl) {
    diagnoses.push({
      label: 'LINE Callback',
      status: 'warn',
      message: 'แอปรับ deep link กลับมาแล้ว แต่หน้า callback ในเว็บไม่ได้รันใน WebView โดยตรง — ดูค่า Last Deep Link ด้านล่าง',
    });
  } else {
    diagnoses.push({
      label: 'LINE Callback',
      status: 'ok',
      message: 'มีการ callback จาก LINE แล้ว',
    });

    if (!info.hasAppPrefixInState && !info.hasAppPrefixInSavedState) {
      diagnoses.push({
        label: 'App-prefix Detection',
        status: 'fail',
        message:
          '❌ State ไม่มี prefix "thetroob_" — ระบบจึงไม่รู้ว่า login มาจากแอป จึงไม่เด้งกลับ. ' +
          'ตรวจสอบโค้ดที่สร้าง state ตอนเริ่ม login LINE บนแอป',
      });
    } else if (info.hasAppPrefixInState) {
      diagnoses.push({
        label: 'App-prefix Detection',
        status: 'ok',
        message: '✅ State มี prefix "thetroob_" → ควรจะเด้งกลับแอป',
      });
    } else {
      diagnoses.push({
        label: 'App-prefix Detection',
        status: 'warn',
        message:
          '⚠️ State ใน URL ไม่มี prefix แต่ savedState มี — อาจเป็นการ retry หรือ LINE ตัด state',
      });
    }
  }

  if (info.isNative) {
    diagnoses.push({
      label: 'Platform',
      status: 'ok',
      message: '✅ กำลังทำงานในแอปแบบ native',
    });
  } else {
    diagnoses.push({
      label: 'Platform',
      status: 'warn',
      message: 'อยู่ในเว็บ/in-app browser ไม่ใช่ native — ต้องเด้งกลับแอปด้วย deep link',
    });
  }

  if (info.lastDeepLinkError) {
    diagnoses.push({
      label: 'Deep Link Error',
      status: 'fail',
      message: `❌ แอปเจอปัญหาระหว่าง parse deep link: ${info.lastDeepLinkError}`,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[85vh] w-[calc(100%-1.5rem)] max-w-md flex-col overflow-hidden p-4 sm:p-6">
        <DialogHeader className="pr-8">
          <DialogTitle>🔍 LINE Login Debug</DialogTitle>
          <DialogDescription className="sr-only">
            หน้าต่างสำหรับตรวจสอบ callback และ deep link ของการเข้าสู่ระบบ LINE
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={refresh}>
            <RefreshCw className="mr-1 h-3 w-3" /> รีเฟรช
          </Button>
          <Button size="sm" variant="outline" onClick={copyAll}>
            <Copy className="mr-1 h-3 w-3" /> คัดลอก
          </Button>
          <Button size="sm" variant="outline" onClick={clearLineDebug}>
            <Trash2 className="mr-1 h-3 w-3" /> ล้าง
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 [-webkit-overflow-scrolling:touch]">
          <div className="space-y-4 pb-4 text-xs">
              <section>
                <h3 className="mb-2 text-sm font-bold">📋 การวินิจฉัย</h3>
                <div className="space-y-2">
                  {diagnoses.map((d, i) => (
                    <div
                      key={i}
                      className={`rounded border p-2 ${
                        d.status === 'ok'
                          ? 'bg-green-50 border-green-200 text-green-900'
                          : d.status === 'warn'
                            ? 'bg-yellow-50 border-yellow-200 text-yellow-900'
                            : 'bg-red-50 border-red-200 text-red-900'
                      }`}
                    >
                      <div className="font-medium">{d.label}</div>
                      <div className="mt-0.5 text-[11px]">{d.message}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-bold">🌐 Environment</h3>
                <div className="space-y-1 rounded bg-muted p-2 font-mono break-all">
                  <div><b>Platform:</b> {info.platform}</div>
                  <div><b>isNative:</b> {String(info.isNative)}</div>
                  <div><b>Origin:</b> {info.origin}</div>
                  <div><b>Href:</b> {info.href}</div>
                  <div><b>UA:</b> {info.userAgent}</div>
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-bold">🔑 LINE OAuth State</h3>
                <div className="space-y-1 rounded bg-muted p-2 font-mono break-all">
                  <div><b>localStorage:</b> {info.lineOAuthStateLocal || '(ไม่มี)'}</div>
                  <div><b>sessionStorage:</b> {info.lineOAuthStateSession || '(ไม่มี)'}</div>
                  <div><b>มี prefix thetroob_ ใน saved:</b> {String(info.hasAppPrefixInSavedState)}</div>
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-bold">📞 Last LINE Callback</h3>
                <div className="space-y-1 rounded bg-muted p-2 font-mono break-all">
                  <div><b>URL:</b> {info.lastCallbackUrl || '(ไม่มี — ยังไม่เคย callback)'}</div>
                  <div><b>Params:</b> {info.lastCallbackParams || '(ไม่มี)'}</div>
                  <div><b>มี prefix thetroob_ ใน state:</b> {String(info.hasAppPrefixInState)}</div>
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-bold">🔗 Last Deep Link</h3>
                <div className="space-y-1 rounded bg-muted p-2 font-mono break-all">
                  <div><b>URL:</b> {info.lastDeepLinkUrl || '(ไม่มี)'}</div>
                  <div><b>Source:</b> {info.lastDeepLinkSource || '(ไม่มี)'}</div>
                  <div><b>At:</b> {info.lastDeepLinkAt || '(ไม่มี)'}</div>
                  <div><b>Error:</b> {info.lastDeepLinkError || '(ไม่มี)'}</div>
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-bold">👤 Auth State</h3>
                <div className="space-y-1 rounded bg-muted p-2 font-mono break-all">
                  <div><b>Login Type:</b> {info.authLoginType || '(ไม่มี)'}</div>
                  <div><b>Driver ID:</b> {info.authDriverId || '(ไม่มี)'}</div>
                  <div><b>มี auth_driver:</b> {String(info.hasAuthDriver)}</div>
                </div>
              </section>
          </div>
        </div>

        <Button onClick={onClose} className="w-full">ปิด</Button>
      </DialogContent>
    </Dialog>
  );
};
