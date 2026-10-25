import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, MapPin, Clock, Package, ClipboardList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { aggregateKpi, kpiTone, type KpiRow } from '@/lib/driverKpi';

type Tx = Record<string, string>;
const TXT: Record<string, Tx> = {
  th: { title: 'KPI', today: 'วันนี้', d7: '7 วัน', d30: '30 วัน', loc: 'ตรงตำแหน่งเช็คอิน', time: 'ตรงเวลานัด', load: 'สัดส่วนงาน', open: 'งานที่ยังเปิดอยู่', passed: 'ผ่าน', points: 'จุด', of: 'จาก', jobs: 'งานของบริษัท', none: 'ยังไม่มีข้อมูล KPI', daily: 'รายวัน', note: 'อัปเดตทุกเที่ยงคืน', rule: 'เกณฑ์: ระยะ ≤ {d} กม. · เวลาต่าง ≤ {m} นาที', err: 'โหลดข้อมูลไม่สำเร็จ' },
  en: { title: 'KPI', today: 'Today', d7: '7 days', d30: '30 days', loc: 'Check-in location', time: 'On time', load: 'Job share', open: 'Open jobs', passed: 'Passed', points: 'points', of: 'of', jobs: 'company jobs', none: 'No KPI data yet', daily: 'Daily', note: 'Updated every midnight', rule: 'Rules: distance ≤ {d} km · time diff ≤ {m} min', err: 'Failed to load data' },
  zh: { title: 'KPI', today: '今天', d7: '7天', d30: '30天', loc: '签到位置准确', time: '准时', load: '任务占比', open: '未完成订单', passed: '通过', points: '个点', of: '/', jobs: '公司订单', none: '暂无KPI数据', daily: '每日', note: '每天午夜更新', rule: '标准：距离 ≤ {d} 公里 · 时间差 ≤ {m} 分钟', err: '加载失败' },
  ko: { title: 'KPI', today: '오늘', d7: '7일', d30: '30일', loc: '체크인 위치', time: '정시', load: '작업 비율', open: '진행 중 작업', passed: '통과', points: '지점', of: '/', jobs: '회사 작업', none: 'KPI 데이터가 없습니다', daily: '일별', note: '매일 자정 업데이트', rule: '기준: 거리 ≤ {d}km · 시간차 ≤ {m}분', err: '불러오기 실패' },
};

const ymd = (d: Date) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10);
const toneCls: Record<string, string> = { good: 'text-green-600', mid: 'text-amber-500', bad: 'text-destructive', none: 'text-muted-foreground' };
const strokeCls: Record<string, string> = { good: 'stroke-green-600', mid: 'stroke-amber-500', bad: 'stroke-destructive', none: 'stroke-muted' };

function Ring({ p }: { p: number | null }) {
  const tone = kpiTone(p);
  const c = 2 * Math.PI * 26;
  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
        <circle cx="32" cy="32" r="26" fill="none" strokeWidth="7" className="stroke-muted" />
        <circle cx="32" cy="32" r="26" fill="none" strokeWidth="7" strokeLinecap="round" className={strokeCls[tone]}
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, p ?? 0) / 100)} />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${toneCls[tone]}`}>{p == null ? '-' : `${Math.round(p)}%`}</span>
    </div>
  );
}

export default function KpiPage() {
  const navigate = useNavigate();
  const { user } = useAuth() as any;
  const { language } = useLanguage();
  const tx = TXT[language] || TXT.th;
  const [range, setRange] = useState<0 | 7 | 30>(30);
  const [rows, setRows] = useState<KpiRow[]>([]);
  const [rules, setRules] = useState<{ max_distance_km?: number; max_time_diff_minutes?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const plate = user?.plate_number || user?.license_plate || '';
  const name = user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.full_name || '';

  useEffect(() => {
    let off = false;
    (async () => {
      setLoading(true); setError(false);
      const now = new Date();
      const from = ymd(new Date(now.getTime() - Math.max(0, range - 1) * 864e5));
      const p = new URLSearchParams({ from, to: ymd(now), limit: '500' });
      if (plate) p.set('license_plate', plate); else if (name) p.set('driver_name', name);
      try {
        const { data, error } = await supabase.functions.invoke(`driver-kpi-proxy?${p}`, { method: 'GET' });
        if (off) return;
        if (error || !data?.success) throw error || new Error('fail');
        setRows(data.data || []); setRules(data.rules || null);
      } catch { if (!off) { setError(true); setRows([]); } }
      finally { if (!off) setLoading(false); }
    })();
    return () => { off = true; };
  }, [range, plate, name]);

  const agg = useMemo(() => aggregateKpi(rows), [rows]);
  const daily = useMemo(() => [...rows].sort((a, b) => b.kpi_date.localeCompare(a.kpi_date)), [rows]);

  const Card = ({ icon: I, label, p, sub }: { icon: any; label: string; p: number | null; sub: string }) => (
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm">
      <Ring p={p} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 font-semibold text-foreground"><I className="w-4 h-4 text-primary" />{label}</div>
        <div className="text-xs text-muted-foreground mt-1">{sub}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b flex items-center gap-2 px-3 py-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        <button onClick={() => navigate(-1)} className="p-1"><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="font-semibold text-lg">{tx.title}</h1>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {([0, 7, 30] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`rounded-lg py-2 text-sm font-medium ${range === r ? 'bg-card shadow text-primary' : 'text-muted-foreground'}`}>
              {r === 0 ? tx.today : r === 7 ? tx.d7 : tx.d30}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : error || rows.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">{error ? tx.err : tx.none}</div>
        ) : (
          <>
            <Card icon={MapPin} label={tx.loc} p={agg.location.pct} sub={`${tx.passed} ${agg.location.passed} / ${agg.location.checked} ${tx.points}`} />
            <Card icon={Clock} label={tx.time} p={agg.time.pct} sub={`${tx.passed} ${agg.time.passed} / ${agg.time.checked} ${tx.points}`} />
            <Card icon={Package} label={tx.load} p={agg.load.pct} sub={`${agg.load.orders} ${tx.of} ${agg.load.company} ${tx.jobs}`} />
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-1.5 font-semibold"><ClipboardList className="w-4 h-4 text-primary" />{tx.open} ({agg.openOrders.length})</div>
              {agg.openOrders.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{agg.openOrders.map((o) => <span key={o} className="text-xs rounded-full bg-muted px-2 py-1">{o}</span>)}</div>}
            </div>
            {daily.length > 1 && (
              <div className="rounded-2xl border bg-card shadow-sm">
                <div className="px-4 pt-3 pb-2 font-semibold">{tx.daily}</div>
                {daily.map((r) => (
                  <div key={r.kpi_date} className="grid grid-cols-4 gap-2 px-4 py-2 border-t text-sm">
                    <span className="text-muted-foreground">{r.kpi_date.slice(5)}</span>
                    {[r.location_pass_pct, r.time_pass_pct, r.load_pct].map((v, i) => (
                      <span key={i} className={`text-right ${toneCls[kpiTone(v ?? null)]}`}>{v == null ? '-' : `${Math.round(v)}%`}</span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <div className="text-xs text-muted-foreground text-center space-y-0.5">
          <div>{tx.note}</div>
          {rules && <div>{tx.rule.replace('{d}', String(rules.max_distance_km ?? 5)).replace('{m}', String(rules.max_time_diff_minutes ?? 20))}</div>}
        </div>
      </div>
    </div>
  );
}
