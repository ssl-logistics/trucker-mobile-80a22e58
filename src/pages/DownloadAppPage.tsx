import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Upload, Smartphone, FileDown, Loader2, Trash2, Truck, Store, Monitor } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import truckerLogo from '@/assets/trucker-logo.png';

interface ApkFile {
  name: string;
  size: number;
  created_at: string;
  url: string;
}

type AppType = 'trucker' | 'dealer' | 'pos';

const APP_CONFIG: Record<AppType, { name: string; icon: React.ReactNode; description: string; gradient: string }> = {
  trucker: {
    name: 'The Trucker',
    icon: <img src={truckerLogo} alt="The Trucker" className="w-10 h-10 object-contain" />,
    description: 'ดาวน์โหลดแอปพลิเคชันสำหรับ Android',
    gradient: 'from-emerald-600 via-emerald-700 to-emerald-800',
  },
  dealer: {
    name: 'Dealer',
    icon: <Store className="w-8 h-8" />,
    description: 'ดาวน์โหลดแอปพลิเคชันสำหรับ Android',
    gradient: 'from-blue-600 via-blue-700 to-blue-800',
  },
  pos: {
    name: 'POS',
    icon: <Monitor className="w-8 h-8" />,
    description: 'ดาวน์โหลดแอปพลิเคชันสำหรับ Android',
    gradient: 'from-violet-600 via-violet-700 to-violet-800',
  },
};

const APP_TYPES: AppType[] = ['trucker', 'dealer', 'pos'];

const formatSize = (bytes: number) => {
  if (!bytes) return 'N/A';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
};

interface AppSectionProps {
  appType: AppType;
  isAdmin: boolean;
}

const AppSection: React.FC<AppSectionProps> = ({ appType, isAdmin }) => {
  const [apkFiles, setApkFiles] = useState<ApkFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const config = APP_CONFIG[appType];

  useEffect(() => {
    loadApkFiles();
  }, [appType]);

  const loadApkFiles = async () => {
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
    if (!file) return;
    if (!file.name.endsWith('.apk')) {
      toast({ title: 'กรุณาเลือกไฟล์ .apk เท่านั้น', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const fileName = `${appType}/${appType}-v${Date.now()}.apk`;
      const { error } = await supabase.storage.from('apk-files').upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
      toast({ title: 'อัปโหลดสำเร็จ!' });
      loadApkFiles();
    } catch (err: any) {
      toast({ title: 'อัปโหลดล้มเหลว', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (fileName: string) => {
    if (!confirm(`ต้องการลบ ${fileName} หรือไม่?`)) return;
    const { error } = await supabase.storage.from('apk-files').remove([fileName]);
    if (error) {
      toast({ title: 'ลบไม่สำเร็จ', variant: 'destructive' });
    } else {
      toast({ title: 'ลบสำเร็จ' });
      loadApkFiles();
    }
  };

  const latestApk = apkFiles[0];

  return (
    <section className={`bg-gradient-to-br ${config.gradient} py-12 px-4`}>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 text-white">
            {config.icon}
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">{config.name}</h2>
          <p className="text-white/70 text-sm">{config.description}</p>
        </div>

        {/* Download Card */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-7 h-7 animate-spin text-white" />
          </div>
        ) : latestApk ? (
          <Card className="mb-5 border-0 shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileDown className="w-5 h-5 text-primary" />
                เวอร์ชันล่าสุด
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
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
                <a href={latestApk.url} download className="block mt-3">
                  <Button className="w-full h-11 text-base font-semibold gap-2" size="lg">
                    <Download className="w-5 h-5" />
                    ดาวน์โหลด APK
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-5 border-0 shadow-xl">
            <CardContent className="py-6 text-center">
              <FileDown className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">ยังไม่มีไฟล์ APK สำหรับ {config.name}</p>
            </CardContent>
          </Card>
        )}

        {/* Install Instructions */}
        <Card className="border-0 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">วิธีติดตั้ง</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1.5 text-sm text-muted-foreground list-decimal list-inside">
              <li>กดปุ่ม "ดาวน์โหลด APK" ด้านบน</li>
              <li>เปิดไฟล์ที่ดาวน์โหลดเสร็จ</li>
              <li>อนุญาตการติดตั้งจากแหล่งที่ไม่รู้จัก (หากถูกถาม)</li>
              <li>กดติดตั้ง แล้วรอจนเสร็จ</li>
            </ol>
          </CardContent>
        </Card>

        {/* Admin Upload */}
        {isAdmin && (
          <Card className="mt-5 border-0 shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Upload className="w-4 h-4" />
                อัปโหลด APK ({config.name})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <label className="block">
                <input type="file" accept=".apk" onChange={handleUpload} disabled={uploading} className="hidden" />
                <Button variant="outline" className="w-full gap-2" disabled={uploading} asChild>
                  <span>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? 'กำลังอัปโหลด...' : 'เลือกไฟล์ APK'}
                  </span>
                </Button>
              </label>
              {apkFiles.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">ไฟล์ทั้งหมด</p>
                  {apkFiles.map(f => (
                    <div key={f.name} className="flex items-center justify-between text-xs p-2 rounded bg-muted/50">
                      <span className="truncate max-w-[180px]">{f.name}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(f.name)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
};

const DownloadAppPage: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
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
    checkAdmin();
  }, []);

  return (
    <div className="min-h-screen">
      {APP_TYPES.map((appType) => (
        <AppSection key={appType} appType={appType} isAdmin={isAdmin} />
      ))}
      <div className="bg-slate-900 py-6 text-center">
        <p className="text-white/40 text-xs">© {new Date().getFullYear()} The Troob. All rights reserved.</p>
      </div>
    </div>
  );
};

export default DownloadAppPage;
