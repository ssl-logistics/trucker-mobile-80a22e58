import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, MapPin, Clock, Package, ClipboardList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { aggregateKpi, kpiTone, kpiCacheKey, isSameBangkokDay, overallPct, type KpiRow } from '@/lib/driverKpi';

type Tx = Record<string, string>;
const TXT: Record<string, Tx> = {
  th: { title: 'KPI ของฉัน', today: 'วันนี้', d7: '7 วัน', d30: '30 วัน', overall: 'คะแนนรวม', good: 'ดีมาก', mid: 'พอใช้', bad: 'ต้องปรับปรุง', loc: 'ตรงตำแหน่ง', time: 'ตรงเวลา', load: 'สัดส่วนงาน', open: 'งานที่ยังเปิดอยู่', passed: 'ผ่าน', of: 'จาก', points: 'จุด', jobs: 'งาน', none: 'ยังไม่มีข้อมูล KPI', daily: 'รายวัน', date: 'วันที่', note: 'ข้อมูลอัปเดตทุกเที่ยงคืน', updated: 'อัปเดตล่าสุด', rule: 'เกณฑ์: ระยะ ≤ {d} กม. · เวลาต่าง ≤ {m} นาที', err: 'โหลดข้อมูลไม่สำเร็จ' },
  en: { title: 'My KPI', today: 'Today', d7: '7 days', d30: '30 days', overall: 'Overall score', good: 'Excellent', mid: 'Fair', bad: 'Needs work', loc: 'Location', time: 'On time', load: 'Job share', open: 'Open jobs', passed: 'Passed', of: 'of', points: 'points', jobs: 'jobs', none: 'No KPI data yet', daily: 'Daily', date: 'Date', note: 'Data updates every midnight', updated: 'Last updated', rule: 'Rules: distance ≤ {d} km · time diff ≤ {m} min', err: 'Failed to load data' },
  zh: { title: '我的KPI', today: '今天', d7: '7天', d30: '30天', overall: '综合得分', good: '优秀', mid: '一般', bad: '需改进', loc: '位置', time: '准时', load: '任务占比', open: '未完成订单', passed: '通过', of: '/', points: '个点', jobs: '单', none: '暂无KPI数据', daily: '每日', date: '日期', note: '每天午夜更新', updated: '最后更新', rule: '标准：距离 ≤ {d} 公里 · 时间差 ≤ {m} 分钟', err: '加载失败' },
  ko: { title: '내 KPI', today: '오늘', d7: '7일', d30: '30일', overall: '종합 점수', good: '우수', mid: '보통', bad: '개선 필요', loc: '위치', time: '정시', load: '작업 비율', open: '진행 중 작업', passed: '통과', of: '/', points: '지점', jobs: '건', none: 'KPI 데이터가 없습니다', daily: '일별', date: '날짜', note: '매일 자정 업데이트', updated: '마지막 업데이트', rule: '기준: 거리 ≤ {d}km · 시간차 ≤ {m}분', err: '불러오기 실패' },
};
const LOCALE: Record<string, string> = { th: 'th-TH', en: 'en-GB', zh: 'zh-CN', ko: 'ko-KR' };

const ymd = (d: Date) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10);
const toneText: Record<string, string> = { good: 'text-green-600', mid: 'text-amber-500', bad: 'text-destructive', none: 'text-muted-foreground' };
const toneStroke: Record<string, string> = { good: 'stroke-green-600', mid: 'stroke-amber-500', bad: 'stroke-destructive', none: 'stroke-muted' };
const toneBg: Record<string, string> = { good: 'bg-green-600', mid: 'bg-amber-500', bad: 'bg-destructive', none: 'bg-muted' };
const fmt = (p: number | null) => (p == null ? '-' : `${Math.round(p)}%`);

type Cache = { fetchedAt: number; rows: KpiRow[]; rules: any };

export default function KpiPage() {
  const navigate = useNavigate();
  const { user } = useAuth() as any;
  const { language } = useLanguage();
  const tx = TXT[language] || TXT.th;
  const locale = LOCALE[language] || 'th-TH';
  const [range, setRange] = useState<0 | 7 | 30>(30);
  const [data, setData] = useState<Cache | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const plate = user?.plate_number || user?.license_plate || '';
  const name = user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.full_name || '';
  const who = plate || name;

  useEffect(() => {
    let off = false;
    const key = kpiCacheKey(who, range);
    let cached: Cache | null = null;
    try { cached = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* ignore */ }
    setError(false);
    if (cached) setData(cached);
    if (cached && isSameBangkokDay(cached.fetchedAt, Date.now())) { setLoading(false); return; }
    setLoading(!cached);
    (async () => {
      const now = new Date();
      const from = ymd(new Date(now.getTime() - Math.max(0, range - 1) * 864e5));
      const p = new URLSearchParams({ from, to: ymd(now), limit: '500' });
      if (plate) p.set('license_plate', plate); else if (name) p.set('driver_name', name);
      try {
        const { data: res, error } = await supabase.functions.invoke(`driver-kpi-proxy?${p}`, { method: 'GET' });
        if (off) return;
        if (error || !res?.success) throw error || new Error('fail');
        const next: Cache = { fetchedAt: Date.now(), rows: res.data || [], rules: res.rules || null };
        try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* quota */ }
        setData(next);
      } catch { if (!off && !cached) { setError(true); setData(null); } }
      finally { if (!off) setLoading(false); }
    })();
    return () => { off = true; };
  }, [range, who, plate, name]);

  const rows = data?.rows || [];
  const rules = data?.rules;
  const agg = useMemo(() => aggregateKpi(rows), [rows]);
  const overall = overallPct(agg.location.pct, agg.time.pct);
  const oTone = kpiTone(overall);
  const daily = useMemo(() => [...rows].sort((a, b) => b.kpi_date.localeCompare(a.kpi_date)), [rows]);
  const C = 2 * Math.PI * 52;

  const Mini = ({ icon: I, label, p, sub }: { icon: any; label: string; p: number | null; sub: string }) => {
    const t = kpiTone(p);
    return (
      <div className="rounded-2xl border bg-card p-3 shadow-sm flex flex-col gap-2">
        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><I className="w-3.5 h-3.5 text-primary" />{label}</div>
        <div className={`text-2xl font-bold ${toneText[t]}`}>{fmt(p)}</div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className={`h-full ${toneBg[t]}`} style={{ width: `${Math.min(100, p ?? 0)}%` }} /></div>
        <div className="text-[11px] text-muted-foreground leading-tight">{sub}</div>
      </div>
    );
  };

  const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b px-3 py-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        <div className="flex items-center gap-2">
          <button aria-label="Back" onClick={() => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/settings', { replace: true }))} className="w-11 h-11 -ml-2 flex items-center justify-center relative z-20 rounded-full active:bg-muted"><ChevronLeft className="w-6 h-6" /></button>
          <h1 className="font-semibold text-lg">{tx.title}</h1>
        </div>
        {data && <div className="text-[11px] text-muted-foreground pl-9">{tx.updated}: {new Date(data.fetchedAt).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
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
            <div className="rounded-2xl border bg-card p-5 shadow-sm flex flex-col items-center">
              <div className="text-sm font-medium text-muted-foreground mb-2">{tx.overall}</div>
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90">
                  <circle cx="60" cy="60" r="52" fill="none" strokeWidth="11" className="stroke-muted" />
                  <circle cx="60" cy="60" r="52" fill="none" strokeWidth="11" strokeLinecap="round" className={toneStroke[oTone]}
                    strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(100, overall ?? 0) / 100)} />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-3xl font-bold ${toneText[oTone]}`}>{fmt(overall)}</span>
              </div>
              {oTone !== 'none' && <div className={`mt-2 rounded-full px-3 py-1 text-sm font-semibold text-primary-foreground ${toneBg[oTone]}`}>{tx[oTone]}</div>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Mini icon={MapPin} label={tx.loc} p={agg.location.pct} sub={`${tx.passed} ${agg.location.passed} ${tx.of} ${agg.location.checked} ${tx.points}`} />
              <Mini icon={Clock} label={tx.time} p={agg.time.pct} sub={`${tx.passed} ${agg.time.passed} ${tx.of} ${agg.time.checked} ${tx.points}`} />
              <Mini icon={Package} label={tx.load} p={agg.load.pct} sub={`${agg.load.orders} ${tx.of} ${agg.load.company} ${tx.jobs}`} />
            </div>
            <div className="rounded-2xl border bg-card shadow-sm">
              <div className="flex items-center gap-1.5 font-semibold px-4 pt-3 pb-2"><ClipboardList className="w-4 h-4 text-primary" />{tx.open} ({agg.openOrders.length})</div>
              {agg.openOrders.map((o) => (
                <button key={o} onClick={() => navigate(`/job/${o}`)} className="w-full flex items-center justify-between px-4 py-3 border-t text-sm active:bg-muted">
                  <span className="font-medium">{o}</span><ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
            {daily.length > 1 && (
              <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                <div className="px-4 pt-3 pb-2 font-semibold">{tx.daily}</div>
                <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-muted text-xs font-medium text-muted-foreground">
                  <span>{tx.date}</span><span className="text-right">{tx.loc}</span><span className="text-right">{tx.time}</span><span className="text-right">{tx.load}</span>
                </div>
                {daily.map((r) => (
                  <div key={r.kpi_date} className="grid grid-cols-4 gap-2 px-4 py-2.5 border-t text-sm">
                    <span>{fmtDay(r.kpi_date)}</span>
                    {[r.location_pass_pct, r.time_pass_pct, r.load_pct].map((v, i) => (
                      <span key={i} className={`text-right font-semibold ${toneText[kpiTone(v ?? null)]}`}>{fmt(v ?? null)}</span>
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
