import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Upload, Smartphone, FileDown, Loader2, Trash2, Store, Monitor } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import truckerLogo from '@/assets/trucker-logo.png';
import truckerIcon from '@/assets/trucker-icon.png';

interface ApkFile {
  name: string;
  size: number;
  created_at: string;
  url: string;
  folder?: string;
}

type AppType = 'trucker' | 'dealer' | 'pos';

const APP_CONFIG: Record<AppType, { name: string; icon: React.ReactNode; description: string; color: string; gradient: string }> = {
  trucker: {
    name: 'The Trucker',
    icon: <img src={truckerIcon} alt="The Trucker" className="w-full h-full object-cover scale-[1.8]" />,
    description: 'แอปสำหรับคนขับรถบรรทุก',
    color: 'from-emerald-600 to-emerald-800',
    gradient: 'from-emerald-600 via-emerald-700 to-emerald-900',
  },
  dealer: {
    name: 'Dealer',
    icon: <Store className="w-8 h-8" />,
    description: 'แอปสำหรับตัวแทนจำหน่าย',
    color: 'from-orange-600 to-red-700',
    gradient: 'from-orange-600 via-red-700 to-red-900',
  },
  pos: {
    name: 'POS',
    icon: <Monitor className="w-8 h-8" />,
    description: 'แอประบบขายหน้าร้าน',
    color: 'from-violet-600 to-violet-800',
    gradient: 'from-violet-600 via-violet-700 to-violet-900',
  },
};

const DownloadAppPage: React.FC = () => {
  const [selectedApp, setSelectedApp] = useState<AppType | null>(null);
  const [apkFiles, setApkFiles] = useState<ApkFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (selectedApp) {
      loadApkFiles(selectedApp);
    }
  }, [selectedApp]);

  const checkAdmin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (data?.role === 'company' || data?.role === 'factory') {
        setIsAdmin(true);
      }
    }
  };

  const loadApkFiles = async (appType: AppType) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-apk-files', {
        body: { appType },
      });
      if (error) {
        console.error('Error loading APK files:', error);
        setApkFiles([]);
        return;
      }
      setApkFiles(data?.files || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedApp) return;

    if (!file.name.endsWith('.apk')) {
      toast({ title: 'กรุณาเลือกไฟล์ .apk เท่านั้น', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const fileName = `${selectedApp}/${selectedApp}-v${Date.now()}.apk`;
      const { error } = await supabase.storage.from('apk-files').upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
      toast({ title: 'อัปโหลดสำเร็จ!' });
      loadApkFiles(selectedApp);
    } catch (err: any) {
      toast({ title: 'อัปโหลดล้มเหลว', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (file: ApkFile) => {
    if (!confirm(`ต้องการลบ ${file.name} หรือไม่?`)) return;
    const fullPath = file.folder ? `${file.folder}/${file.name}` : file.name;
    const { error } = await supabase.storage.from('apk-files').remove([fullPath]);
    if (error) {
      toast({ title: 'ลบไม่สำเร็จ', variant: 'destructive' });
    } else {
      toast({ title: 'ลบสำเร็จ' });
      if (selectedApp) loadApkFiles(selectedApp);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const latestApk = apkFiles[0];
  const config = selectedApp ? APP_CONFIG[selectedApp] : null;

  // App selection screen
  if (!selectedApp) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-lg mx-auto px-4 py-10">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Smartphone className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">ดาวน์โหลดแอป</h1>
            <p className="text-white/60 text-sm">เลือกแอปที่ต้องการติดตั้ง</p>
          </div>

          <div className="space-y-4">
            {(Object.keys(APP_CONFIG) as AppType[]).map((appType) => {
              const app = APP_CONFIG[appType];
              return (
                <button
                  key={appType}
                  onClick={() => setSelectedApp(appType)}
                  className="w-full group"
                >
                  <Card className="border-0 shadow-xl bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 group-hover:scale-[1.02]">
                    <CardContent className="flex items-center gap-4 p-5">
                      {appType === 'trucker' ? (
                        <div className="w-14 h-14 rounded-xl overflow-hidden shadow-lg flex-shrink-0">
                          {app.icon}
                        </div>
                      ) : (
                        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${app.color} flex items-center justify-center text-white shadow-lg flex-shrink-0`}>
                          {app.icon}
                        </div>
                      )}
                      <div className="text-left flex-1">
                        <h2 className="text-lg font-bold text-white">{app.name}</h2>
                        <p className="text-white/50 text-sm">{app.description}</p>
                      </div>
                      <Download className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors" />
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>

          <p className="text-center text-white/30 text-xs mt-10">
            © {new Date().getFullYear()} The Troob. All rights reserved.
          </p>
        </div>
      </div>
    );
  }

  // App detail / download screen
  return (
    <div className={`min-h-screen bg-gradient-to-br ${config!.gradient}`}>
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Back + Header */}
        <button
          onClick={() => { setSelectedApp(null); setApkFiles([]); }}
          className="text-white/70 hover:text-white text-sm mb-6 flex items-center gap-1 transition-colors"
        >
          ← กลับ
        </button>

        <div className="text-center mb-8">
          <div className={`w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 text-white`}>
            {config!.icon}
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{config!.name}</h1>
          <p className="text-white/70">{config!.description} — Android</p>
        </div>

        {/* Download Card */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
        ) : latestApk ? (
          <Card className="mb-6 border-0 shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileDown className="w-5 h-5 text-primary" />
                เวอร์ชันล่าสุด
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ไฟล์</span>
                  <span className="font-medium truncate ml-2 max-w-[200px]">{latestApk.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ขนาด</span>
                  <span className="font-medium">{formatSize(latestApk.size)}</span>
                </div>
                {latestApk.created_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">วันที่</span>
                    <span className="font-medium">
                      {new Date(latestApk.created_at).toLocaleDateString('th-TH', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </span>
                  </div>
                )}
                <a href={latestApk.url} download className="block mt-4">
                  <Button className="w-full h-12 text-base font-semibold gap-2" size="lg">
                    <Download className="w-5 h-5" />
                    ดาวน์โหลด APK
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-6 border-0 shadow-xl">
            <CardContent className="py-8 text-center">
              <FileDown className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">ยังไม่มีไฟล์ APK สำหรับ {config!.name}</p>
            </CardContent>
          </Card>
        )}

        {/* Install Instructions */}
        <Card className="mb-6 border-0 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">วิธีติดตั้ง</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>กดปุ่ม "ดาวน์โหลด APK" ด้านบน</li>
              <li>เปิดไฟล์ที่ดาวน์โหลดเสร็จ</li>
              <li>อนุญาตการติดตั้งจากแหล่งที่ไม่รู้จัก (หากถูกถาม)</li>
              <li>กดติดตั้ง แล้วรอจนเสร็จ</li>
            </ol>
          </CardContent>
        </Card>

        {/* Admin Upload */}
        {isAdmin && (
          <Card className="mb-6 border-0 shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="w-4 h-4" />
                อัปโหลด APK ใหม่ ({config!.name})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <label className="block">
                <input
                  type="file"
                  accept=".apk"
                  onChange={handleUpload}
                  disabled={uploading}
                  className="hidden"
                />
                <Button variant="outline" className="w-full gap-2" disabled={uploading} asChild>
                  <span>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? 'กำลังอัปโหลด...' : 'เลือกไฟล์ APK'}
                  </span>
                </Button>
              </label>

              {apkFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">ไฟล์ทั้งหมด</p>
                  {apkFiles.map(f => (
                    <div key={f.name} className="flex items-center justify-between text-xs p-2 rounded bg-muted/50">
                      <span className="truncate max-w-[180px]">{f.name}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(f)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-white/40 text-xs mt-8">
          © {new Date().getFullYear()} The Troob. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default DownloadAppPage;
