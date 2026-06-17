/**
 * AISettings — 3-tab AI 实验室（设计源自 claude_design/model-log）
 *
 * Tab 1: 模型日志 — 用量统计面板（启用引导/空态/实时曲线/多维统计表）
 * Tab 2: 供应商管理 — cc-switch 风格卡片网格 + 启用开关 + 连接测试
 * Tab 3: 路由映射 — 三级模型分配
 *
 * 使用 SVG 彩色 Logo（logos/），所有功能 handler 接入真实 store，不缓存数据。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAIStore, type AIProvider } from '../../store/aiStore';
import { useSettingsStore } from '../../store/settingsStore';
import { usePermissionStore, TIER_LABELS, type PermissionTier, DEFAULT_TIERS } from '../../store/permissionStore';
import { DOMAIN_CLASSIFICATIONS, ALL_DOMAINS, type Domain } from '../../lib/ai/privacy';
import {
  useUsageStore,
  PROVIDERS, PROVIDER_BY_ID, MODELS_BY_PROVIDER, getDefaultModels,
  TONE, summarize, trend, providerStats, modelStats,
  fmtInt, fmtUsd, fmtTokensShort, fmtTime, costOf, logoUrl,
  type UsageRecord, type DailyBucket, type Summary, type ProviderStat, type ModelStat,
} from '../../store/usageStore';

// ══════════════════════════════════════════════════════════════════════
//  Design Tokens
// ══════════════════════════════════════════════════════════════════════

const T = {
  bg:         'var(--color-bg-primary)',
  bgCard:     'var(--color-bg-secondary)',
  bgTint:     'var(--color-bg-tertiary)',
  bgTertiary: 'var(--color-bg-tertiary)',
  border:     'var(--color-border)',
  accent:     'var(--color-accent)',
  accentDim:  'var(--color-accent-light)',
  accentTxt:  'var(--color-accent-hover)',
  text:       'var(--color-text-primary)',
  text2:      'var(--color-text-secondary)',
  text3:      'var(--color-text-tertiary)',
  text4:      'var(--color-text-placeholder)',
  text5:      'var(--color-text-placeholder)',
  green:      '#3F8F5B',
  greenBg:    'rgba(63,143,91,0.12)',
  danger:     '#C4502E',
  shadow:     'var(--color-card-shadow)',
};

// ══════════════════════════════════════════════════════════════════════
//  Ico — 内联 SVG 图标组件
// ══════════════════════════════════════════════════════════════════════

function Ico({ p, s = '#5C5A57', sz = 16 }: { p: string; s?: string; sz?: number }) {
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      <path d={p} />
    </svg>
  );
}

function Spinner({ color = '#fff' }: { color?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ animation: 'pcspin 0.7s linear infinite' }}>
      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  ProviderLogo — 供应商 Logo（本地 SVG，缺省回退品牌色字章）
// ══════════════════════════════════════════════════════════════════════

function ProviderLogo({ slug, color, name, size = 22, radius = 6 }: {
  slug: string | null | undefined; color: string; name: string; size?: number; radius?: number;
}) {
  const [err, setErr] = useState(false);
  const letter = (name || '?').replace(/[^A-Za-z一-龥]/g, '').charAt(0).toUpperCase() || '?';
  if (!slug || err) {
    return (
      <span style={{
        width: size, height: size, borderRadius: radius, flex: 'none',
        background: `linear-gradient(150deg, ${color}, ${shade(color, -12)})`, color: '#fff',
        display: 'grid', placeItems: 'center',
        font: `700 ${Math.round(size * 0.46)}px Inter, sans-serif`,
        boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.35)', letterSpacing: '-0.02em',
      }}>
        {letter}
      </span>
    );
  }
  return (
    <span style={{
      width: size, height: size, borderRadius: radius, flex: 'none',
      background: T.bgCard, border: '0.5px solid var(--color-border)',
      display: 'grid', placeItems: 'center', overflow: 'hidden',
    }}>
      <img src={logoUrl(slug)} alt={name} onError={() => setErr(true)}
        style={{ width: Math.round(size * 0.66), height: Math.round(size * 0.66), display: 'block' }} />
    </span>
  );
}

function shade(hex: string, pct: number): string {
  const m = (hex || '').replace('#', '');
  if (m.length !== 6) return hex;
  const n = parseInt(m, 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + Math.round(255 * pct / 100)));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + Math.round(255 * pct / 100)));
  const b = Math.max(0, Math.min(255, (n & 255) + Math.round(255 * pct / 100)));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// ══════════════════════════════════════════════════════════════════════
//  Segmented Control
// ══════════════════════════════════════════════════════════════════════

function Segmented({ value, onChange, options }: {
  value: string; onChange: (k: string) => void;
  options: { k: string; label: string; icon?: string }[];
}) {
  return (
    <div style={{ display: 'flex', gap: 2, padding: 3, background: T.bgTint,
      border: `0.5px solid ${T.border}`, borderRadius: 11 }}>
      {options.map((o) => {
        const on = value === o.k;
        return (
          <button key={o.k} onClick={() => onChange(o.k)} style={{
            padding: '9px 20px', border: 'none', borderRadius: 8, cursor: 'pointer',
            font: `600 13.5px Inter, sans-serif`, whiteSpace: 'nowrap',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: on ? '#fff' : 'transparent',
            color: on ? T.text : T.text3,
            boxShadow: on ? '0 1px 2px rgba(26,24,20,0.07)' : 'none',
            transition: 'all .14s',
          }}>
            {o.icon && <Ico p={o.icon} s={on ? T.accent : T.text4} sz={15} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  Segmented Small（用于范围/来源选择）
// ══════════════════════════════════════════════════════════════════════

function SegSml({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div style={{ display: 'flex', padding: 3, gap: 2, background: T.bgTint,
      border: `0.5px solid ${T.border}`, borderRadius: 10 }}>
      {options.map(([k, label]) => {
        const on = value === k;
        return (
          <button key={k} onClick={() => onChange(k)} style={{
            padding: '6px 12px', border: 'none', borderRadius: 7, cursor: 'pointer',
            font: '500 12.5px Inter, sans-serif', whiteSpace: 'nowrap',
            background: on ? T.bgCard : 'transparent',
            color: on ? T.text : T.text3,
            boxShadow: on ? T.shadow : 'none',
          }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  TrendChart — 平滑曲线趋势图（保留原设计）
// ══════════════════════════════════════════════════════════════════════

function niceMax(v: number) {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * exp;
}

function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const t = 0.16;
    const c1x = p1.x + (p2.x - p0.x) * t, c1y = p1.y + (p2.y - p0.y) * t;
    const c2x = p2.x - (p3.x - p1.x) * t, c2y = p2.y - (p3.y - p1.y) * t;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

function TrendChart({ data, range }: { data: DailyBucket[]; range: string }) {
  // ... identical to original
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(900);
  const [hover, setHover] = useState<number | null>(null);
  const H = 300;
  const padL = 50, padR = 54, padT = 16, padB = 34;

  useLayoutEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((ents) => {
      for (const e of ents) setW(Math.max(340, e.contentRect.width));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const series = [
    { key: 'input' as const, name: '输入', color: TONE.input },
    { key: 'output' as const, name: '输出', color: TONE.output },
    { key: 'cacheWrite' as const, name: '缓存创建', color: TONE.cacheWrite },
    { key: 'cacheRead' as const, name: '缓存命中', color: TONE.cacheRead },
  ];

  const n = data.length;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const maxTok = niceMax(Math.max(1, ...data.map(d => Math.max(d.input, d.output, d.cacheWrite, d.cacheRead))));
  const maxCost = niceMax(Math.max(0.0001, ...data.map(d => d.cost)));
  const yTok = (v: number) => padT + plotH - (v / maxTok) * plotH;
  const yCost = (v: number) => padT + plotH - (v / maxCost) * plotH;

  const ptsOf = (key: keyof DailyBucket, yfn: (v: number) => number) =>
    data.map((d, i) => ({ x: x(i), y: yfn(d[key] as number) }));
  const lineOf = (key: keyof DailyBucket, yfn: (v: number) => number) => smoothPath(ptsOf(key, yfn));
  const areaOf = (key: keyof DailyBucket) => {
    const p = smoothPath(ptsOf(key, yTok));
    if (!p) return '';
    return p + ` L ${x(n - 1)} ${padT + plotH} L ${x(0)} ${padT + plotH} Z`;
  };

  const labelEvery = n <= 8 ? 1 : n <= 16 ? 2 : n <= 24 ? 3 : Math.ceil(n / 10);

  const onMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let i = Math.round(((e.clientX - rect.left - padL) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <svg width={W} height={H} style={{ display: 'block' }}>
        <defs>
          {series.map(s => (
            <linearGradient key={s.key} id={'tg_' + s.key} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {Array.from({ length: 5 }).map((_, i) => {
          const v = (maxTok / 4) * i; const yy = yTok(v);
          return (
            <g key={i}>
              <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="#E5E3DF" strokeDasharray="3 3" opacity="0.7" />
              <text x={padL - 8} y={yy + 4} textAnchor="end" fontSize="11" fill="#9C958C" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0)}
              </text>
            </g>
          );
        })}
        {Array.from({ length: 5 }).map((_, i) => {
          const v = (maxCost / 4) * i;
          return (
            <text key={i} x={W - padR + 8} y={yCost(v) + 4} textAnchor="start" fontSize="11" fill="#B6452F" opacity="0.8" style={{ fontVariantNumeric: 'tabular-nums' }}>
              ${v < 1 ? v.toFixed(2) : v.toFixed(1)}
            </text>
          );
        })}

        {series.map(s => <path key={'a' + s.key} d={areaOf(s.key)} fill={`url(#tg_${s.key})`} />)}
        {series.map(s => <path key={'l' + s.key} d={lineOf(s.key, yTok)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />)}
        <path d={lineOf('cost', yCost)} fill="none" stroke={TONE.cost} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />

        {data.map((d, i) => ((i % labelEvery === 0 || i === n - 1) && (
          <text key={i} x={x(i)} y={H - padB + 20} textAnchor="middle" fontSize="11" fill="#9C958C">{d.label}</text>
        )))}

        {hover != null && data[hover] && (
          <g pointerEvents="none">
            <line x1={x(hover)} y1={padT} x2={x(hover)} y2={padT + plotH} stroke="#1A1814" strokeOpacity="0.16" />
            {series.map(s => <circle key={s.key} cx={x(hover)} cy={yTok(data[hover][s.key])} r="3.5" fill="#fff" stroke={s.color} strokeWidth="2" />)}
            <circle cx={x(hover)} cy={yCost(data[hover].cost)} r="3.5" fill="#fff" stroke={TONE.cost} strokeWidth="2" />
          </g>
        )}
        <rect x={padL} y={padT} width={plotW} height={plotH} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>

      {hover != null && data[hover] && (
        <div style={{
          position: 'absolute', top: 6, left: Math.min(W - 184, Math.max(6, x(hover) + 12)), width: 172,
          background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 10,
          boxShadow: 'var(--shadow-md)', padding: '10px 12px',
          pointerEvents: 'none', backdropFilter: 'blur(8px)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{data[hover].label}</span>
            <span style={{ fontSize: 11, color: T.text4 }}>{data[hover].requests} 次</span>
          </div>
          {series.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, marginBottom: 3 }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: s.color }} />
              <span style={{ color: T.text2 }}>{s.name}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 600, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(data[hover][s.key])}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, marginTop: 5, paddingTop: 5, borderTop: '0.5px solid #EFEDE9' }}>
            <span style={{ width: 7, height: 2, background: TONE.cost }} />
            <span style={{ color: T.text2 }}>成本</span>
            <span style={{ marginLeft: 'auto', fontWeight: 600, color: TONE.cost, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(data[hover].cost, 4)}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
        {[
          { n: '成本', c: TONE.cost, dash: true },
          { n: '缓存创建', c: TONE.cacheWrite },
          { n: '缓存命中', c: TONE.cacheRead },
          { n: '输入', c: TONE.input },
          { n: '输出', c: TONE.output },
        ].map(it => (
          <span key={it.n} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.text2 }}>
            {it.dash
              ? <span style={{ width: 14, height: 0, borderTop: `2px dashed ${it.c}` }} />
              : <span style={{ width: 14, height: 8, borderRadius: 99, background: it.c }} />
            }{it.n}
          </span>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  EmptyState（设计源自 model-log 空态）
// ══════════════════════════════════════════════════════════════════════

function EmptyState({ icon, title, desc, cta, onCta, note, small }: {
  icon: string; title: string; desc: string;
  cta?: string; onCta?: () => void; note?: string; small?: boolean;
}) {
  return (
    <div style={{
      background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 16,
      boxShadow: T.shadow, padding: small ? '48px 32px' : '64px 32px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: 'rgba(217,119,87,0.1)',
        display: 'grid', placeItems: 'center', marginBottom: 18, position: 'relative',
      }}>
        <Ico p={icon} s={T.accent} sz={30} />
        <span style={{ position: 'absolute', inset: -6, borderRadius: 22, border: '1px dashed rgba(217,119,87,0.3)' }} />
      </div>
      <h3 style={{ font: '700 18px Inter, sans-serif', color: T.text, margin: '0 0 8px' }}>{title}</h3>
      <p style={{ font: '13.5px/1.6 Inter, sans-serif', color: T.text3, margin: 0, maxWidth: 440 }}>{desc}</p>
      {cta && onCta && (
        <button onClick={onCta} style={{
          marginTop: 22, display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '11px 22px', borderRadius: 10, border: 'none',
          background: T.accent, color: '#fff',
          font: '600 14px Inter, sans-serif', cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(217,119,87,0.3)',
        }}>
          <Ico p="M13 2L3 14h7l-1 8 10-12h-7l1-8z" s="#fff" sz={16} />
          {cta}
        </button>
      )}
      {note && (
        <div style={{ marginTop: 14, font: '11.5px Inter, sans-serif', color: T.text5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Ico p="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" s={T.text5} sz={13} />
          {note}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  TAB 1: UsageStats（模型日志）— 来自 model-log UsageStats.jsx
// ══════════════════════════════════════════════════════════════════════

function UsageStats() {
  const usageStore = useUsageStore();
  const { enabled, setEnabled, getLogs } = usageStore;
  const aiProviders = useAIStore(s => s.providers);
  const enabledProviders = useMemo(() => aiProviders.filter(p => p.enabled && p.apiKey), [aiProviders]);

  const [range, setRange] = useState('today');
  const [source, setSource] = useState('all');
  const [tab, setTab] = useState('logs');
  const [tick, setTick] = useState(0);

  // 自动启用用量统计：当有已启用的厂商时
  useEffect(() => {
    if (enabledProviders.length > 0 && !enabled) {
      setEnabled(true);
    }
  }, [enabledProviders.length, enabled, setEnabled]);

  useEffect(() => {
    const unsub = useUsageStore.subscribe(() => setTick(t => t + 1));
    return unsub;
  }, []);

  const allRangeLogs = useMemo(() => getLogs(range), [range, tick, getLogs]);
  const scoped = useMemo(() =>
    source === 'all' ? allRangeLogs : allRangeLogs.filter(l => l.source === source),
  [allRangeLogs, source]);
  const summary = useMemo(() => summarize(scoped), [scoped]);
  const trendData = useMemo(() => trend(scoped, range), [scoped, range]);
  const provStats = useMemo(() => providerStats(scoped), [scoped]);
  const modStats = useMemo(() => modelStats(scoped), [scoped]);

  const [logProvider, setLogProvider] = useState('all');
  const [logStatus, setLogStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const filteredLogs = useMemo(() => scoped.filter(l => {
    if (logProvider !== 'all' && l.providerId !== logProvider) return false;
    if (logStatus === 'ok' && l.status !== 200) return false;
    if (logStatus === 'err' && l.status === 200) return false;
    if (query) {
      const p = PROVIDER_BY_ID[l.providerId];
      const hay = (l.model + ' ' + (p ? p.name + p.cn : '')).toLowerCase();
      if (!hay.includes(query.toLowerCase())) return false;
    }
    return true;
  }), [scoped, logProvider, logStatus, query]);
  const pageCount = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const curPage = Math.min(page, pageCount);
  const pageLogs = filteredLogs.slice((curPage - 1) * pageSize, curPage * pageSize);

  const RANGES: [string, string][] = [['today', '当天'], ['1d', '近 1 天'], ['7d', '近 7 天'], ['30d', '近 30 天']];
  const SOURCE_TABS = ['all', '聊天', '智能拆解', '工作流', '宠物'];

  if (!enabled || enabledProviders.length === 0) {
    return (
      <EmptyState
        icon="M13 2L3 14h7l-1 8 10-12h-7l1-8z"
        title="暂未检测到已启用的 AI 供应商"
        desc="请先在「供应商」标签页配置 API Key 并启用至少一个供应商。用量统计会在每次模型请求完成时自动记录 Token 消耗、时延与成本。"
        note="数据仅保存在本机 · 保留 90 天"
      />
    );
  }

  const hasData = allRangeLogs.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ font: '700 22px/1.2 Inter, sans-serif', color: T.text, margin: 0, letterSpacing: '-0.01em' }}>使用统计</h2>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 9px', borderRadius: 99, background: T.greenBg,
              font: '600 11px Inter, sans-serif', color: T.green,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: T.green }} />
              已启用
            </span>
          </div>
          <p style={{ font: '13px/1.4 Inter, sans-serif', color: T.text3, margin: '4px 0 0' }}>
            实时记录各模型调用量、Token 与成本 · 本地保留 90 天
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SegSml value={range} onChange={setRange} options={RANGES} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ font: '500 12px Inter, sans-serif', color: T.text4 }}>来源</span>
        <SegSml value={source} onChange={(v) => { setSource(v); }} options={SOURCE_TABS.map(s => [s, s === 'all' ? '全部' : s])} />
        <div style={{ marginLeft: 'auto' }} />
      </div>

      {!hasData ? (
        <EmptyState
          icon="M3 3v18h18 M7 14l3-3 3 3 5-5"
          title="正在等待第一条请求"
          desc="用量统计已开启。当你在聊天、智能拆解、工作流或宠物对话中调用 AI 后，这里会立刻出现实时曲线与明细。想先预览效果，可点「模拟实时」或「回填演示数据」。"
          small
        />
      ) : (
        <>
          <Hero summary={summary} />
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 style={cardTitle}>使用趋势</h3>
              <span style={{ font: '12px Inter, sans-serif', color: T.text4 }}>
                {range === 'today' || range === '1d' ? '按小时' : '按天'} · {RANGES.find(r => r[0] === range)?.[1]}
              </span>
            </div>
            <TrendChart data={trendData} range={range} />
          </div>
          <div>
            <SegSml value={tab} onChange={(v) => setTab(v)} options={[
              ['logs', '请求日志'],
              ['providers', 'Provider 统计'],
              ['models', '模型统计'],
            ]} />
            <div style={{ marginTop: 14 }}>
              {tab === 'logs' && (
                <div style={card}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select value={logProvider} onChange={e => { setLogProvider(e.target.value); setPage(1); }} style={selectSt(T.text4, 150)}>
                      <option value="all">全部供应商</option>
                      {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select value={logStatus} onChange={e => { setLogStatus(e.target.value); setPage(1); }} style={selectSt(T.text4, 110)}>
                      <option value="all">全部状态</option>
                      <option value="ok">成功</option>
                      <option value="err">失败</option>
                    </select>
                    <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                      <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}>
                        <Ico p="M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0 M21 21l-4.3-4.3" s={T.text4} />
                      </span>
                      <input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}
                        placeholder="搜索模型 / 供应商…"
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          padding: '8px 12px 8px 32px',
                          border: `0.5px solid ${T.border}`, borderRadius: 8,
                          background: T.bg, font: '13px Inter, sans-serif',
                          color: T.text, outline: 'none',
                        }} />
                    </div>
                    <span style={{ font: '12px Inter, sans-serif', color: T.text4, marginLeft: 'auto' }}>
                      共 {filteredLogs.length} 条
                    </span>
                  </div>
                  <LogTable logs={pageLogs} />
                  {pageCount > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginTop: 14 }}>
                      <PageBtn disabled={curPage === 1} onClick={() => setPage(curPage - 1)}>‹</PageBtn>
                      {Array.from({ length: Math.min(pageCount, 7) }).map((_, i) => (
                        <PageBtn key={i} active={curPage === i + 1} onClick={() => setPage(i + 1)}>{i + 1}</PageBtn>
                      ))}
                      <PageBtn disabled={curPage === pageCount} onClick={() => setPage(curPage + 1)}>›</PageBtn>
                    </div>
                  )}
                </div>
              )}
              {tab === 'providers' && (
                <div style={card}>
                  <StatTable cols={['供应商', '请求数', 'Tokens', '成本', '成功率', '平均延迟']}
                    aligns={['l', 'r', 'r', 'r', 'r', 'r']}
                    rows={provStats.map(s => [
                      <span key="p" style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                        <ProviderLogo slug={s.logo} color={s.color} name={s.name} />
                        <span><span style={{ color: T.text, fontWeight: 500 }}>{s.name}</span> <span style={{ color: T.text5, fontSize: 12 }}>{s.cn}</span></span>
                      </span>,
                      fmtInt(s.requests), fmtInt(s.tokens), fmtUsd(s.cost),
                      <span key="sr" style={{ color: s.successRate >= 99 ? T.green : '#C99A4B' }}>{s.successRate.toFixed(1)}%</span>,
                      Math.round(s.avgLatency * 1000) + 'ms',
                    ])} />
                </div>
              )}
              {tab === 'models' && (
                <div style={card}>
                  <StatTable cols={['模型', '供应商', '请求数', 'Tokens', '总成本', '平均成本/次']}
                    aligns={['l', 'l', 'r', 'r', 'r', 'r']}
                    rows={modStats.map(s => {
                      const p = PROVIDER_BY_ID[s.providerId];
                      return [
                        <span key="m" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flex: 'none' }} />
                          <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5, color: T.text }}>{s.model}</span>
                        </span>,
                        <span key="pl" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <ProviderLogo slug={p?.logo ?? null} color={p?.color ?? '#888'} name={p?.name ?? '?'} size={16} radius={4} />
                          {p ? p.name : s.providerId}
                        </span>,
                        fmtInt(s.requests), fmtInt(s.tokens), fmtUsd(s.cost), fmtUsd(s.avgCost, 6),
                      ];
                    })} />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────
function Hero({ summary }: { summary: Summary }) {
  const hit = Math.max(0, Math.min(100, summary.cacheHitRate * 100));
  const mini = [
    { label: '新增输入', value: fmtTokensShort(summary.input), color: TONE.input, p: 'M12 3v14 M6 11l6 6 6-6' },
    { label: '输出', value: fmtTokensShort(summary.output), color: TONE.output, p: 'M12 21V7 M6 13l6-6 6 6' },
    { label: '缓存创建', value: fmtTokensShort(summary.cacheWrite), color: TONE.cacheWrite, p: 'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7' },
    { label: '缓存命中', value: fmtTokensShort(summary.cacheRead), color: TONE.cacheRead, p: 'M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z' },
  ];
  return (
    <div style={{ ...card, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(217,119,87,0.12)',
            display: 'grid', placeItems: 'center', flex: 'none',
          }}>
            <Ico p="M13 2L3 14h7l-1 8 10-12h-7l1-8z" s={T.accent} sz={22} />
          </div>
          <div>
            <div style={{ font: '500 12px Inter, sans-serif', color: T.text3, marginBottom: 2 }}>真实消耗 Tokens</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{
                font: '700 30px/1 Inter, sans-serif', color: T.text,
                letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
              }}>{fmtInt(summary.realTotal)}</span>
              <span style={{
                font: '12px Inter, sans-serif', color: T.text3,
                background: T.bgTint, padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap',
              }}>≈ {fmtTokensShort(summary.realTotal, 2)}</span>
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 20,
          background: T.bg, padding: '10px 18px', borderRadius: 12, border: `0.5px solid ${T.border}`,
        }}>
          <div>
            <div style={miniLabel}>总请求数</div>
            <div style={{ font: '600 16px Inter, sans-serif', color: T.text, display: 'flex', alignItems: 'center', gap: 5, fontVariantNumeric: 'tabular-nums' }}>
              <Ico p="M22 12h-4l-3 9L9 3l-3 9H2" s={T.accent} sz={15} />{fmtInt(summary.requests)}
            </div>
          </div>
          <div style={{ width: 1, height: 30, background: T.border }} />
          <div>
            <div style={miniLabel}>成功率</div>
            <div style={{ font: '600 16px Inter, sans-serif', color: T.green, fontVariantNumeric: 'tabular-nums' }}>{summary.successRate.toFixed(1)}%</div>
          </div>
          <div style={{ width: 1, height: 30, background: T.border }} />
          <div>
            <div style={miniLabel}>总成本</div>
            <div style={{ font: '600 16px Inter, sans-serif', color: T.accentTxt, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(summary.cost)}</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginTop: 14 }}>
        {mini.map(m => (
          <div key={m.label} style={{ border: `0.5px solid ${T.border}`, background: T.bg, borderRadius: 12, padding: '11px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ico p={m.p} s={m.color} sz={14} />
              <span style={{ font: '500 11.5px Inter, sans-serif', color: T.text2 }}>{m.label}</span>
            </div>
            <div style={{ font: '600 15px Inter, sans-serif', color: T.text, fontVariantNumeric: 'tabular-nums' }}>{m.value}</div>
          </div>
        ))}
        <div style={{
          border: `0.5px solid ${T.border}`, background: T.bg, borderRadius: 12,
          padding: '11px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
            <span style={{ font: '500 11.5px Inter, sans-serif', color: T.text2 }}>缓存命中率</span>
            <span style={{ font: '700 12px Inter, sans-serif', color: TONE.cacheRead, fontVariantNumeric: 'tabular-nums' }}>{hit.toFixed(1)}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: '#EAE7E2', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: hit + '%', background: TONE.cacheRead, borderRadius: 99, transition: 'width .8s ease' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── LogTable ──────────────────────────────────────────────────────────
function LogTable({ logs }: { logs: UsageRecord[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
        <thead>
          <tr>
            {['时间', '供应商', '模型', '输入', '输出', '成本', '用时/首字', '状态', '来源'].map((h, i) => (
              <th key={h} style={{ ...thSt, textAlign: i >= 3 && i <= 5 ? 'right' : 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map(l => {
            const p = PROVIDER_BY_ID[l.providerId];
            return (
              <tr key={l.id} style={{ borderTop: '0.5px solid #EFEDE9' }}>
                <td style={{ ...tdSt, color: T.text3, whiteSpace: 'nowrap' }}>{fmtTime(l.ts)}</td>
                <td style={tdSt}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <ProviderLogo slug={p?.logo ?? null} color={p?.color ?? '#888'} name={p?.name ?? '?'} size={18} radius={4} />
                    {p ? p.name : l.providerId}
                  </span>
                </td>
                <td style={{ ...tdSt, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: T.text2 }}>{l.model}</td>
                <td style={{ ...tdSt, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtInt(l.input)}
                  {l.cacheRead > 0 && <div style={{ font: '11px Inter', color: TONE.cacheRead }}>R {fmtInt(l.cacheRead)}</div>}
                </td>
                <td style={{ ...tdSt, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(l.output)}</td>
                <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(l.cost)}</td>
                <td style={{ ...tdSt, color: T.text3, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{l.dur}s / {l.ttfb}s</td>
                <td style={tdSt}>
                  <span style={{ font: '600 12px Inter', color: l.status === 200 ? T.green : T.danger, fontVariantNumeric: 'tabular-nums' }}>{l.status}</span>
                </td>
                <td style={tdSt}>
                  <span style={{ font: '11.5px Inter', color: T.text3, background: T.bgTint, padding: '2px 8px', borderRadius: 6 }}>{l.source}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── StatTable ─────────────────────────────────────────────────────────
function StatTable({ cols, aligns, rows }: {
  cols: string[]; aligns: string[]; rows: React.ReactNode[][];
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={c} style={{ ...thSt, textAlign: aligns[i] === 'r' ? 'right' : 'left' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} style={{ borderTop: '0.5px solid #EFEDE9', background: ri % 2 ? '#FCFBFA' : 'transparent' }}>
              {r.map((cell, ci) => (
                <td key={ci} style={{
                  ...tdSt, textAlign: aligns[ci] === 'r' ? 'right' : 'left',
                  fontVariantNumeric: 'tabular-nums', color: T.text2,
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────
function PageBtn({ children, active, disabled, onClick }: {
  children: React.ReactNode; active?: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      minWidth: 30, height: 30, padding: '0 8px', borderRadius: 8,
      cursor: disabled ? 'default' : 'pointer',
      border: `0.5px solid ${active ? T.accent : T.border}`,
      background: active ? T.accent : T.bgCard,
      color: active ? '#fff' : (disabled ? '#C9C5BF' : T.text2),
      font: '500 13px Inter, sans-serif',
    }}>
      {children}
    </button>
  );
}

const card = { background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 16, padding: 18, boxShadow: T.shadow };
const cardTitle = { font: '600 15px Inter, sans-serif', color: T.text, margin: 0 };
const thSt = { font: '600 11px Inter, sans-serif', color: T.text4, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 14px 10px', whiteSpace: 'nowrap' };
const tdSt = { font: '13px Inter, sans-serif', color: T.text2, padding: '13px 14px', verticalAlign: 'middle' };
const miniLabel = { font: '500 10px Inter, sans-serif', color: T.text4, textTransform: 'uppercase', letterSpacing: '0.06em' };
const selectSt = (c: string, w: number) => ({
  width: w, padding: '8px 28px 8px 12px',
  border: `0.5px solid ${T.border}`, borderRadius: 8,
  background: `${T.bg} url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%238C8A87' stroke-width='2'><path d='M2 4l4 4 4-4'/></svg>") no-repeat right 10px center`,
  font: '13px Inter, sans-serif', color: T.text, outline: 'none',
  appearance: 'none' as const, cursor: 'pointer',
});
const iconBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent',
  transition: 'background 0.12s',
};

// ══════════════════════════════════════════════════════════════════════
//  TAB 2: ProviderConfigTab — 全量预设卡片网格 + 启用开关 + 连接测试
//  设计源自 cc-switch ProviderCard / ProviderConfig 组件
// ══════════════════════════════════════════════════════════════════════

// ── 切换开关 ──
function Toggle({ checked, onChange, size = 36 }: {
  checked: boolean; onChange: (v: boolean) => void; size?: number;
}) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onChange(!checked); }} style={{
      width: size, height: Math.round(size * 0.56), borderRadius: 99,
      border: 'none', cursor: 'pointer', position: 'relative', flex: 'none',
      background: checked ? T.green : '#D6D3CE',
      transition: 'background .18s',
      padding: 0,
    }}>
      <span style={{
        position: 'absolute', top: 2, left: checked ? size - Math.round(size * 0.56) + 2 : 2,
        width: Math.round(size * 0.56) - 4, height: Math.round(size * 0.56) - 4,
        borderRadius: '50%', background: T.bgCard, transition: 'left .18s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      }} />
    </button>
  );
}

const CATEGORY_ORDER = ['cn_official', 'official', 'aggregator', 'third_party'];
const CATEGORY_LABELS: Record<string, string> = {
  official: '国外官方',
  cn_official: '国内官方',
  aggregator: '聚合代理',
  third_party: '第三方代理',
  cloud_provider: '云平台',
};
const CATEGORY_COLORS: Record<string, string> = {
  official: '#1A1814',
  cn_official: '#D97757',
  aggregator: '#3F7DF0',
  third_party: '#9C7BB0',
  cloud_provider: '#FF9900',
};

// ── Provider 配置表单（弹出式面板） ──
function ProviderConfigForm({ provider, onClose, onSave }: {
  provider: (typeof PROVIDERS)[number];
  onClose: () => void;
  onSave: (config: { baseUrl: string; apiKey: string; activeModel: string; selectedModels: string[]; fetchedModels?: string[] }) => void;
}) {
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [active, setActive] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [testMsg, setTestMsg] = useState('');

  const defaultModels = getDefaultModels(provider.id);
  const [models, setModels] = useState<string[]>(defaultModels);

  const keyValid = apiKey.length >= 8;
  const urlValid = /^https?:\/\/.+/.test(baseUrl);

  const doTest = useCallback(async () => {
    if (!keyValid || !urlValid) return;
    setTesting(true);
    setTestResult('idle');
    setTestMsg('');
    try {
      const resp = await fetch(baseUrl.replace(/\/+$/, '') + '/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) {
        setTestResult('fail');
        setTestMsg(`HTTP ${resp.status} ${resp.statusText}`);
      } else {
        const data = await resp.json();
        const fetched: string[] = [];
        if (data?.data && Array.isArray(data.data)) {
          for (const m of data.data) {
            if (m.id) fetched.push(m.id);
          }
        }
        if (fetched.length > 0) {
          setModels(fetched);
          // 测试成功后不自动选任何 model，用户手动多选
        }
        setTestResult('ok');
        setTestMsg(`连接成功 · ${fetched.length} 个模型`);
      }
    } catch (e: unknown) {
      setTestResult('fail');
      setTestMsg(e instanceof Error ? e.message : '连接失败');
    } finally {
      setTesting(false);
    }
  }, [baseUrl, apiKey, keyValid, urlValid, active]);

  const doSave = () => {
    if (testResult !== 'ok' || selectedModels.length === 0) return;
    onSave({ baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, activeModel: selectedModels[0], selectedModels, fetchedModels: models });
  };

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px',
    border: `0.5px solid ${T.border}`, borderRadius: 9,
    background: T.bgCard, font: '13.5px Inter, sans-serif',
    color: T.text, outline: 'none',
  };

  return (
    <div style={{
      background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 16,
      padding: 24, boxShadow: T.shadow, maxWidth: 600,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <ProviderLogo slug={provider.logo} color={provider.iconColor || provider.color || '#888'} name={provider.name} size={36} radius={8} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{provider.name}</div>
          <div style={{ fontSize: 12, color: T.text3 }}>{provider.baseUrl}</div>
        </div>
        <button onClick={onClose} style={{ marginLeft: 'auto', ...iconBtn }}>
          <Ico p="M18 6L6 18 M6 6l12 12" s={T.text3} sz={16} />
        </button>
      </div>

      <Field label="Base URL">
        <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
          placeholder="https://api.example.com/v1"
          style={{ ...inp, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }} />
      </Field>

      <Field label="API Key">
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <Ico p="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z M7 11V7a5 5 0 0 1 10 0v4" s={T.text4} sz={15} />
          </span>
          <input type={showKey ? 'text' : 'password'}
            value={apiKey} onChange={e => setApiKey(e.target.value)}
            placeholder="sk-…  仅保存于本机"
            style={{ ...inp, padding: '10px 70px 10px 36px', fontFamily: 'ui-monospace, Menlo, monospace' }} />
          <button onClick={() => setShowKey(!showKey)} style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            border: 'none', background: 'transparent', cursor: 'pointer',
            font: '12px Inter', color: T.text3, padding: '4px 8px',
          }}>
            {showKey ? '隐藏' : '显示'}
          </button>
        </div>
      </Field>

      {/* 连接测试 */}
      <div style={{
        border: `0.5px solid ${T.border}`, borderRadius: 12,
        padding: 16, background: T.bg, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ font: '600 13.5px Inter, sans-serif', color: T.text }}>连接测试</div>
            <div style={{ font: '11.5px Inter', color: T.text3, marginTop: 2 }}>
              {testResult === 'ok'
                ? <span style={{ color: T.green }}>{testMsg}</span>
                : testResult === 'fail'
                  ? <span style={{ color: T.danger }}>{testMsg}</span>
                  : '填写 API Key 后点击测试'}
            </div>
          </div>
          <button onClick={doTest}
            disabled={!keyValid || !urlValid || testing}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 9, border: 'none',
              cursor: (!keyValid || !urlValid) ? 'not-allowed' : 'pointer',
              background: (!keyValid || !urlValid) ? '#EAE7E2' : (testResult === 'ok' ? T.green : T.accent),
              color: (!keyValid || !urlValid) ? T.text5 : '#fff',
              font: '600 13px Inter, sans-serif',
            }}>
            {testing
              ? <><Spinner />测试中…</>
              : testResult === 'ok'
                ? <><Ico p="M20 6 9 17l-5-5" s="#fff" sz={15} />连接成功</>
                : <><Ico p="M21 12a9 9 0 1 1-6.2-8.5 M21 3v6h-6" s="#fff" sz={15} />测试连接</>
            }
          </button>
        </div>

        {/* 模型列表 */}
        {models.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ font: '500 12px Inter, sans-serif', color: T.text4, marginBottom: 8 }}>
              可用模型 ({models.length}){testResult === 'ok' ? ' — 从 API 拉取' : ''}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {models.map(m => {
                const sel = selectedModels.includes(m);
                return (
                  <button key={m} onClick={() => {
                    setSelectedModels(prev =>
                      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
                    );
                  }} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 11px', borderRadius: 8, cursor: 'pointer',
                    border: `0.5px solid ${sel ? T.accent : T.border}`,
                    background: sel ? T.accentDim : '#fff',
                    font: '500 12px ui-monospace, Menlo, monospace',
                    color: sel ? T.accentTxt : T.text2,
                  }}>
                    <span style={{
                      width: 14, height: 14, borderRadius: 3, flex: 'none',
                      border: `1.5px solid ${sel ? T.accent : T.border}`,
                      background: sel ? T.accent : 'transparent',
                      display: 'grid', placeItems: 'center',
                    }}>
                      {sel && <Ico p="M4 10l4 4 8-8" s="#fff" sz={10} />}
                    </span>
                    {m.length > 35 ? m.slice(0, 32) + '…' : m}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button onClick={onClose} style={{
          padding: '10px 18px', borderRadius: 9,
          border: `0.5px solid ${T.border}`, background: T.bgCard,
          font: '500 13px Inter', color: T.text2, cursor: 'pointer',
        }}>
          取消
        </button>
        <button onClick={doSave} disabled={testResult !== 'ok' || selectedModels.length === 0}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '10px 20px', borderRadius: 9, border: 'none',
            background: testResult === 'ok' && selectedModels.length > 0 ? T.text : '#EAE7E2',
            color: testResult === 'ok' && selectedModels.length > 0 ? '#fff' : T.text5,
            font: '600 13px Inter', cursor: testResult === 'ok' && selectedModels.length > 0 ? 'pointer' : 'not-allowed',
          }}>
          <Ico p="M5 12h14 M12 5v14" s={testResult === 'ok' && selectedModels.length > 0 ? '#fff' : T.text5} sz={15} />
          启用并保存
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, bad, children }: {
  label: string; hint?: string; bad?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7 }}>
        <label style={{ font: '600 12px Inter, sans-serif', color: T.text2 }}>{label}</label>
        {hint && <span style={{ font: '11px Inter', color: bad ? T.danger : T.text4 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ── ProviderCard（单个供应商卡片） ──
function ProviderCard({ preset, configured, enabled, onConfigure, onToggle, onEdit, onDelete }: {
  preset: (typeof PROVIDERS)[number];
  configured: boolean;
  enabled: boolean;
  onConfigure: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hover, setHover] = useState(false);

  const borderColor = enabled ? T.green : (configured ? T.accent : T.border);
  const borderWidth = enabled || configured ? 1.5 : 0.5;
  const gradientOverlay = enabled
    ? 'linear-gradient(135deg, rgba(63,143,91,0.04) 0%, transparent 60%)'
    : configured
      ? 'linear-gradient(135deg, rgba(217,119,87,0.04) 0%, transparent 60%)'
      : 'none';

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={configured ? onEdit : onConfigure}
      style={{
        position: 'relative', borderRadius: 14, cursor: 'pointer',
        border: `${borderWidth}px solid ${borderColor}`,
        background: `${enabled ? '#F9FDF9' : configured ? T.accentDim : T.bgCard}`,
        padding: 16, transition: 'all .16s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        minHeight: 120,
      }}>
      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 13,
        background: gradientOverlay, pointerEvents: 'none',
      }} />
      {/* Hover gradient */}
      {hover && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 13,
          background: enabled
            ? 'linear-gradient(135deg, rgba(63,143,91,0.08) 0%, transparent 50%)'
            : configured
              ? 'linear-gradient(135deg, rgba(217,119,87,0.08) 0%, transparent 50%)'
              : 'rgba(0,0,0,0.02)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Logo */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <ProviderLogo
          slug={preset.logo ?? null}
          color={preset.color ?? '#888'}
          name={preset.name}
          size={40}
          radius={10}
        />
      </div>

      {/* Name */}
      <div style={{
        position: 'relative', zIndex: 1,
        fontSize: 11.5, fontWeight: 600, color: T.text,
        textAlign: 'center', lineHeight: 1.3,
      }}>
        {preset.name}
      </div>

      {/* Category badge */}
      {preset.category && (
        <div style={{
          position: 'relative', zIndex: 1,
          fontSize: 9.5, color: CATEGORY_COLORS[preset.category] || T.text5,
          fontWeight: 500, letterSpacing: '0.03em',
        }}>
          {CATEGORY_LABELS[preset.category] || preset.category}
        </div>
      )}

      {/* Toggle + status row */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto',
      }}>
        {configured ? (
          <>
            <Toggle checked={enabled} onChange={onToggle} size={30} />
            <span style={{ fontSize: 10, fontWeight: 500, color: enabled ? T.green : T.text4 }}>
              {enabled ? '已启用' : '已配置'}
            </span>
          </>
        ) : (
          <span style={{
            fontSize: 10, fontWeight: 500, color: T.text5,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Ico p="M12 5v14 M5 12h14" s={T.text5} sz={12} />
            点击配置
          </span>
        )}
      </div>

      {/* Hover actions */}
      {hover && configured && (
        <div style={{
          position: 'absolute', top: 8, right: 8, zIndex: 2,
          display: 'flex', gap: 2,
        }}>
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} style={miniIconBtn} title="编辑">
            <Ico p="M4 20h4L19 9l-4-4L4 16z M14 6l4 4" s={T.text3} sz={13} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={miniIconBtn} title="删除">
            <Ico p="M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13" s={T.danger} sz={13} />
          </button>
        </div>
      )}
    </div>
  );
}

const miniIconBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 6, border: 'none',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

// ── 自定义供应商卡片 ──
function CustomProviderCard({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        borderRadius: 14, cursor: 'pointer',
        border: `1.5px dashed ${hover ? T.accent : T.border}`,
        background: hover ? T.accentDim : 'transparent',
        padding: 16, transition: 'all .16s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
        minHeight: 120,
      }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: hover ? 'rgba(217,119,87,0.12)' : '#F0EDE8',
        display: 'grid', placeItems: 'center',
      }}>
        <Ico p="M12 5v14 M5 12h14" s={hover ? T.accentTxt : T.text4} sz={20} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: hover ? T.accentTxt : T.text3, textAlign: 'center' }}>
        自定义供应商
      </div>
      <div style={{ fontSize: 10, color: T.text5, textAlign: 'center' }}>
        手动填入 Base URL 与 API Key
      </div>
    </div>
  );
}

// ── Main ProviderConfigTab ──
function ProviderConfigTab() {
  const { providers, addProvider, updateProvider, deleteProvider, setActiveProvider } = useAIStore();

  const [showDialog, setShowDialog] = useState(false);
  const [customForm, setCustomForm] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<(typeof PROVIDERS)[number] | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Group providers by category
  const grouped = useMemo(() => {
    const groups: Record<string, (typeof PROVIDERS)[number][]> = {};
    for (const p of PROVIDERS) {
      const cat = p.category || 'third_party';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    }
    return groups;
  }, []);

  const filteredGroups = useMemo(() => {
    if (filter === 'all' && !search) return grouped;
    const g: typeof grouped = {};
    for (const [cat, items] of Object.entries(grouped)) {
      const filtered = items.filter(p =>
        (filter === 'all' || p.category === filter) &&
        (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search.toLowerCase()))
      );
      if (filtered.length > 0) g[cat] = filtered;
    }
    return g;
  }, [grouped, filter, search]);

  // Build a map of presetId → configured provider
  const configuredMap = useMemo(() => {
    const m = new Map<string, AIProvider>();
    for (const p of providers) {
      if (p.presetId) m.set(p.presetId, p);
    }
    return m;
  }, [providers]);

  const handleSave = useCallback((preset: (typeof PROVIDERS)[number], config: { baseUrl: string; apiKey: string; activeModel: string; selectedModels: string[]; fetchedModels?: string[] }) => {
    addProvider({
      name: preset.name,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      fetchedModels: config.fetchedModels ?? [],
      selectedModels: config.selectedModels,
      activeModel: config.activeModel,
      enabled: false,
      kind: 'openai',
      isPreset: false,
      notes: '',
      consoleUrl: undefined,
      logo: preset.logo,
      iconColor: preset.iconColor || preset.color,
      category: preset.category,
      presetId: preset.id,
    });
    setSelectedPreset(null);
    setShowDialog(false);
    setCustomForm(false);
  }, [addProvider]);

  const handleToggleEnable = useCallback((preset: (typeof PROVIDERS)[number]) => {
    const existing = configuredMap.get(preset.id);
    if (existing) {
      updateProvider(existing.id, { enabled: !existing.enabled });
    }
  }, [configuredMap, updateProvider]);

  const handleDelete = useCallback((presetId: string) => {
    const existing = configuredMap.get(presetId);
    if (existing) {
      deleteProvider(existing.id);
      setDeleteConfirm(null);
    }
  }, [configuredMap, deleteProvider]);

  // ── 自定义供应商表单 ──
  const [custName, setCustName] = useState('');
  const [custUrl, setCustUrl] = useState('');
  const [custKey, setCustKey] = useState('');
  const [custShowKey, setCustShowKey] = useState(false);

  const handleCustomSave = () => {
    if (!custName.trim() || !custUrl.trim() || !custKey.trim()) return;
    addProvider({
      name: custName.trim(),
      baseUrl: custUrl.trim().replace(/\/$/, ''),
      apiKey: custKey,
      fetchedModels: [],
      selectedModels: [],
      activeModel: '',
      enabled: false,
      kind: 'openai',
      isPreset: false,
      notes: '',
      consoleUrl: undefined,
      logo: null,
      iconColor: '#5C5A57',
      category: null,
      presetId: null,
    });
    setCustomForm(false);
    setCustName('');
    setCustUrl('');
    setCustKey('');
  };

  // ── 编辑已配置的供应商（弹出配置面板，已填 Key 不覆盖） ──
  const [editProviderId, setEditProviderId] = useState<string | null>(null);
  const editingProvider = useMemo(() => {
    if (!editProviderId) return null;
    const p = providers.find(x => x.id === editProviderId);
    if (!p) return null;
    const preset = PROVIDERS.find(pr => pr.id === p.presetId);
    return { provider: p, preset };
  }, [editProviderId, providers]);

  // ── 编辑保存回调 ──
  const [editingFormKey, setEditingFormKey] = useState(0);
  const handleEditSave = useCallback((config: { baseUrl: string; apiKey: string; activeModel: string; selectedModels: string[]; fetchedModels?: string[] }) => {
    if (!editProviderId) return;
    const patch: Partial<AIProvider> = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      activeModel: config.activeModel,
      selectedModels: config.selectedModels,
    };
    if (config.fetchedModels && config.fetchedModels.length > 0) {
      patch.fetchedModels = config.fetchedModels;
    }
    updateProvider(editProviderId, patch);
    setEditProviderId(null);
    setEditingFormKey(k => k + 1);
  }, [editProviderId, updateProvider]);

  // ── EditProviderForm（编辑已配置厂商，预填 Key 并可跳过测试保存） ──
  function EditProviderForm({ provider, preset, onSave, onCancel }: {
    provider: AIProvider;
    preset?: (typeof PROVIDERS)[number];
    onSave: (config: { baseUrl: string; apiKey: string; activeModel: string; selectedModels: string[]; fetchedModels?: string[] }) => void;
    onCancel: () => void;
  }) {
    const [baseUrl, setBaseUrl] = useState(provider.baseUrl);
    const [apiKey, setApiKey] = useState(provider.apiKey || '');
    const [showKey, setShowKey] = useState(false);
    const [selectedModels, setSelectedModels] = useState<string[]>(provider.selectedModels?.length > 0 ? provider.selectedModels : []);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<'idle' | 'ok' | 'fail'>('idle');
    const [testMsg, setTestMsg] = useState('');

    const defaultModels = preset ? getDefaultModels(preset.id) : [];
    const [models, setModels] = useState<string[]>(provider.fetchedModels.length > 0 ? provider.fetchedModels : defaultModels);

    const keyValid = apiKey.length >= 8;
    const urlValid = /^https?:\/\/.+/.test(baseUrl);

    const doTest = useCallback(async () => {
      if (!keyValid || !urlValid) return;
      setTesting(true);
      setTestResult('idle');
      setTestMsg('');
      try {
        const resp = await fetch(baseUrl.replace(/\/+$/, '') + '/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) {
          setTestResult('fail');
          setTestMsg(`HTTP ${resp.status} ${resp.statusText}`);
        } else {
          const data = await resp.json();
          const fetched: string[] = [];
          if (data?.data && Array.isArray(data.data)) {
            for (const m of data.data) {
              if (m.id) fetched.push(m.id);
            }
          }
          if (fetched.length > 0) {
            setModels(fetched);
            // 编辑时不自动选中，保留已有选择
          }
          setTestResult('ok');
          setTestMsg(`连接成功 · ${fetched.length} 个模型`);
        }
      } catch (e: unknown) {
        setTestResult('fail');
        setTestMsg(e instanceof Error ? e.message : '连接失败');
      } finally {
        setTesting(false);
      }
    }, [baseUrl, apiKey, keyValid, urlValid]);

    const doSave = () => {
      onSave({
        baseUrl: baseUrl.replace(/\/+$/, ''),
        apiKey,
        activeModel: selectedModels[0] || models[0] || '',
        selectedModels: selectedModels.length > 0 ? selectedModels : [models[0] || ''],
        fetchedModels: models,
      });
    };

    const inp: React.CSSProperties = {
      width: '100%', boxSizing: 'border-box', padding: '10px 12px',
      border: `0.5px solid ${T.border}`, borderRadius: 9,
      background: T.bgCard, font: '13.5px Inter, sans-serif',
      color: T.text, outline: 'none',
    };

    const logoSlug = provider.logo || preset?.logo || null;
    const logoColor = provider.iconColor || preset?.iconColor || preset?.color || '#888';
    const displayName = provider.name || preset?.name || '';

    return (
      <div style={{
        background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 16,
        padding: 24, boxShadow: T.shadow, maxWidth: 600,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <ProviderLogo slug={logoSlug} color={logoColor} name={displayName} size={36} radius={8} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{displayName}</div>
            <div style={{ fontSize: 12, color: T.text3 }}>{baseUrl}</div>
          </div>
          <button onClick={onCancel} style={{ marginLeft: 'auto', ...iconBtn }}>
            <Ico p="M18 6L6 18 M6 6l12 12" s={T.text3} sz={16} />
          </button>
        </div>

        <Field label="Base URL">
          <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com/v1"
            style={{ ...inp, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }} />
        </Field>

        <Field label="API Key" hint={provider.apiKey ? 'Key 已存在，可修改后重新测试' : ''}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
              <Ico p="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z M7 11V7a5 5 0 0 1 10 0v4" s={T.text4} sz={15} />
            </span>
            <input type={showKey ? 'text' : 'password'}
              value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder={provider.apiKey ? '· · · · · · · · · · · ·（已填写）' : 'sk-…'}
              style={{ ...inp, padding: '10px 70px 10px 36px', fontFamily: 'ui-monospace, Menlo, monospace' }} />
            <button onClick={() => setShowKey(!showKey)} style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              border: 'none', background: 'transparent', cursor: 'pointer',
              font: '12px Inter', color: T.text3, padding: '4px 8px',
            }}>
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
        </Field>

        {/* 连接测试 */}
        <div style={{
          border: `0.5px solid ${T.border}`, borderRadius: 12,
          padding: 16, background: T.bg, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ font: '600 13.5px Inter, sans-serif', color: T.text }}>连接测试</div>
              <div style={{ font: '11.5px Inter', color: T.text3, marginTop: 2 }}>
                {testResult === 'ok'
                  ? <span style={{ color: T.green }}>{testMsg}</span>
                  : testResult === 'fail'
                    ? <span style={{ color: T.danger }}>{testMsg}</span>
                    : '修改配置后建议重新测试连接'}
              </div>
            </div>
            <button onClick={doTest}
              disabled={!keyValid || !urlValid || testing}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '9px 16px', borderRadius: 9, border: 'none',
                cursor: (!keyValid || !urlValid) ? 'not-allowed' : 'pointer',
                background: (!keyValid || !urlValid) ? '#EAE7E2' : (testResult === 'ok' ? T.green : T.accent),
                color: (!keyValid || !urlValid) ? T.text5 : '#fff',
                font: '600 13px Inter, sans-serif',
              }}>
              {testing
                ? <><Spinner />测试中…</>
                : testResult === 'ok'
                  ? <><Ico p="M20 6 9 17l-5-5" s="#fff" sz={15} />连接成功</>
                  : <><Ico p="M21 12a9 9 0 1 1-6.2-8.5 M21 3v6h-6" s="#fff" sz={15} />测试连接</>
              }
            </button>
          </div>

          {/* 模型列表 */}
          {models.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ font: '500 12px Inter, sans-serif', color: T.text4, marginBottom: 8 }}>
                可用模型 ({models.length}){testResult === 'ok' ? ' — 从 API 拉取' : (provider.fetchedModels.length > 0 ? ' — 上次获取' : '')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {models.map(m => {
                  const sel = selectedModels.includes(m);
                  return (
                    <button key={m} onClick={() => {
                      setSelectedModels(prev =>
                        prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
                      );
                    }} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 11px', borderRadius: 8, cursor: 'pointer',
                      border: `0.5px solid ${sel ? T.accent : T.border}`,
                      background: sel ? T.accentDim : '#fff',
                      font: '500 12px ui-monospace, Menlo, monospace',
                      color: sel ? T.accentTxt : T.text2,
                    }}>
                      <span style={{
                        width: 14, height: 14, borderRadius: 3, flex: 'none',
                        border: `1.5px solid ${sel ? T.accent : T.border}`,
                        background: sel ? T.accent : 'transparent',
                        display: 'grid', placeItems: 'center',
                      }}>
                        {sel && <Ico p="M4 10l4 4 8-8" s="#fff" sz={10} />}
                      </span>
                      {m.length > 35 ? m.slice(0, 32) + '…' : m}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onCancel} style={{
            padding: '10px 18px', borderRadius: 9,
            border: `0.5px solid ${T.border}`, background: T.bgCard,
            font: '500 13px Inter', color: T.text2, cursor: 'pointer',
          }}>
            取消
          </button>
          <button onClick={doSave}
            disabled={testResult !== 'ok' || selectedModels.length === 0}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '10px 20px', borderRadius: 9, border: 'none',
              background: testResult === 'ok' && selectedModels.length > 0 ? T.text : '#EAE7E2',
              color: testResult === 'ok' && selectedModels.length > 0 ? '#fff' : T.text5,
              font: '600 13px Inter', cursor: testResult === 'ok' && selectedModels.length > 0 ? 'pointer' : 'not-allowed',
            }}>
            <Ico p="M5 12h14 M12 5v14" s={testResult === 'ok' && selectedModels.length > 0 ? '#fff' : T.text5} sz={15} />
            保存更改
          </button>
        </div>
      </div>
    );
  }

  // ── Provider Card Grid ──
  const renderGrid = () => (
    <div>
      {/* 过滤器 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <SegSml value={filter} onChange={setFilter} options={[
          ['all', '全部'],
          ['cn_official', '国内官方'],
          ['official', '国外官方'],
          ['aggregator', '聚合代理'],
          ['third_party', '第三方'],
        ]} />
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}>
            <Ico p="M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0 M21 21l-4.3-4.3" s={T.text4} sz={14} />
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索供应商…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '7px 12px 7px 34px',
              border: `0.5px solid ${T.border}`, borderRadius: 8,
              background: T.bg, font: '13px Inter, sans-serif',
              color: T.text, outline: 'none',
            }} />
        </div>
      </div>

      {/* 已配置的供应商列表 — 仅显示已启用（enabled: true）的厂商 */}
      {(() => {
        const enabledProviders = providers.filter(p => p.enabled);
        if (!enabledProviders.length) return null;
        return (
        <div style={{
          marginBottom: 24, padding: 0, borderRadius: 14,
          border: '0.5px solid var(--color-border)',
          background: 'var(--color-bg-secondary)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 18px 0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h3 style={{ font: '600 14px/1.2 Inter, sans-serif', color: 'var(--color-text-primary)', margin: 0 }}>
              已启用供应商
            </h3>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
              background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)',
            }}>{enabledProviders.length}</span>
          </div>
          <div style={{ padding: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {enabledProviders.slice().reverse().map(p => {
                const preset = PROVIDERS.find(pr => pr.id === p.presetId);
                const catColor = CATEGORY_COLORS[p.category || ''] || 'var(--color-text-tertiary)';
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 12,
                    border: `0.5px solid ${p.enabled ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
                    background: p.enabled
                      ? 'var(--color-bg-primary)'
                      : 'var(--color-bg-secondary)',
                    transition: 'all var(--transition-fast)',
                    minWidth: 220, flex: '1 1 auto', maxWidth: '100%',
                    boxShadow: p.enabled ? 'var(--color-card-shadow)' : 'none',
                  }}>
                    <div style={{ position: 'relative', flex: 'none' }}>
                      <ProviderLogo slug={p.logo ?? preset?.logo ?? null}
                        color={p.iconColor || preset?.color || '#888'}
                        name={p.name} size={32} radius={8} />
                      {/* 品牌色圆点指示分类 */}
                      <span style={{
                        position: 'absolute', bottom: -2, right: -2,
                        width: 8, height: 8, borderRadius: '50%',
                        border: '1.5px solid var(--color-bg-secondary)',
                        background: catColor,
                      }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {p.name}
                        </span>
                        <span style={{
                          fontSize: 9, padding: '1px 5px', borderRadius: 99,
                          background: p.enabled ? 'rgba(63,143,91,0.12)' : 'var(--color-bg-tertiary)',
                          color: p.enabled ? '#3F8F5B' : 'var(--color-text-tertiary)',
                          fontWeight: 600, letterSpacing: '0.01em',
                        }}>
                          {p.enabled ? '启用' : '禁用'}
                        </span>
                      </div>
                      <div style={{
                        fontSize: 11, color: 'var(--color-text-tertiary)',
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {p.activeModel || '未选择模型'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 'none' }}>
                      <Toggle checked={p.enabled} onChange={(v) => updateProvider(p.id, { enabled: v })} size={32} />
                      <button onClick={() => setEditProviderId(p.id)} style={{
                        ...iconBtn, width: 28, height: 28,
                      }} title="编辑">
                        <Ico p="M4 20h4L19 9l-4-4L4 16z M14 6l4 4" s="var(--color-text-tertiary)" sz={14} />
                      </button>
                      <button onClick={() => setDeleteConfirm(p.id)} style={{
                        ...iconBtn, width: 28, height: 28,
                      }} title="删除">
                        <Ico p="M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13" s="#C4502E" sz={14} />
                      </button>
                      {deleteConfirm === p.id && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '4px 8px', background: '#FCF3F1', borderRadius: 8, flex: 'none',
                        }}>
                          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>删除？</span>
                          <button onClick={() => setDeleteConfirm(null)} style={{
                            fontSize: 11, padding: '2px 5px', borderRadius: 5, border: 'none',
                            cursor: 'pointer', background: 'transparent', color: 'var(--color-text-primary)',
                          }}>取消</button>
                          <button onClick={() => { deleteProvider(p.id); setDeleteConfirm(null); }} style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 5, border: 'none',
                            cursor: 'pointer', background: '#C4502E', color: '#fff',
                          }}>删除</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
      })()}

      {/* 预设卡片网格 */}
      {CATEGORY_ORDER.map(cat => {
        const items = filteredGroups[cat];
        if (!items?.length) return null;
        return (
          <div key={cat} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 2,
                background: CATEGORY_COLORS[cat] || T.text4, flex: 'none',
              }} />
              <h3 style={{ font: '600 14px Inter, sans-serif', color: T.text, margin: 0 }}>
                {CATEGORY_LABELS[cat] || cat}
              </h3>
              <span style={{ font: '12px Inter, sans-serif', color: T.text4 }}>{items.length}</span>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10,
            }}>
              {items.map(preset => {
                const configured = configuredMap.has(preset.id);
                const existing = configuredMap.get(preset.id);
                return (
                  <ProviderCard
                    key={preset.id}
                    preset={preset}
                    configured={configured}
                    enabled={existing?.enabled ?? false}
                    onConfigure={() => { setSelectedPreset(preset); }}
                    onToggle={() => handleToggleEnable(preset)}
                    onEdit={() => { setSelectedPreset(preset); }}
                    onDelete={() => handleDelete(preset.id)}
                  />
                );
              })}
              {/* Custom button at end of third_party */}
              {cat === 'third_party' && (
                <CustomProviderCard onClick={() => setCustomForm(true)} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Selected provider config form (shown as overlay) ──
  if (selectedPreset) {
    return (
      <div>
        <button onClick={() => setSelectedPreset(null)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', marginBottom: 16,
          border: `0.5px solid ${T.border}`, borderRadius: 8,
          background: T.bgCard, font: '500 12px Inter', color: T.text2, cursor: 'pointer',
        }}>
          <Ico p="M19 12H5 M12 19l-7-7 7-7" s={T.text2} sz={14} />返回
        </button>
        <ProviderConfigForm
          provider={selectedPreset}
          onClose={() => setSelectedPreset(null)}
          onSave={(config) => handleSave(selectedPreset, config)}
        />
      </div>
    );
  }

  // ── 自定义供应商表单 ──
  if (customForm) {
    const inp: React.CSSProperties = {
      width: '100%', boxSizing: 'border-box', padding: '10px 12px',
      border: `0.5px solid ${T.border}`, borderRadius: 9,
      background: T.bgCard, font: '13.5px Inter, sans-serif',
      color: T.text, outline: 'none',
    };

    return (
      <div style={{ maxWidth: 560 }}>
        <button onClick={() => setCustomForm(false)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', marginBottom: 16,
          border: `0.5px solid ${T.border}`, borderRadius: 8,
          background: T.bgCard, font: '500 12px Inter', color: T.text2, cursor: 'pointer',
        }}>
          <Ico p="M19 12H5 M12 19l-7-7 7-7" s={T.text2} sz={14} />返回
        </button>
        <div style={{
          background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 16,
          padding: 24, boxShadow: T.shadow,
        }}>
          <h2 style={{ font: '700 18px/1.2 Inter, sans-serif', color: T.text, margin: '0 0 20px' }}>
            自定义供应商
          </h2>
          <Field label="供应商名称">
            <input value={custName} onChange={e => setCustName(e.target.value)}
              placeholder="例如：My Custom API" style={inp} />
          </Field>
          <Field label="Base URL">
            <input value={custUrl} onChange={e => setCustUrl(e.target.value)}
              placeholder="https://api.custom.com/v1"
              style={{ ...inp, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }} />
          </Field>
          <Field label="API Key">
            <div style={{ position: 'relative' }}>
              <input type={custShowKey ? 'text' : 'password'}
                value={custKey} onChange={e => setCustKey(e.target.value)}
                placeholder="sk-…"
                style={{ ...inp, padding: '10px 70px 10px 12px', fontFamily: 'ui-monospace, Menlo, monospace' }} />
              <button onClick={() => setCustShowKey(!custShowKey)} style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                border: 'none', background: 'transparent', cursor: 'pointer',
                font: '12px Inter', color: T.text3, padding: '4px 8px',
              }}>
                {custShowKey ? '隐藏' : '显示'}
              </button>
            </div>
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button onClick={() => setCustomForm(false)} style={{
              padding: '10px 18px', borderRadius: 9,
              border: `0.5px solid ${T.border}`, background: T.bgCard,
              font: '500 13px Inter', color: T.text2, cursor: 'pointer',
            }}>取消</button>
            <button onClick={handleCustomSave}
              disabled={!custName.trim() || !custUrl.trim() || !custKey.trim()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '10px 20px', borderRadius: 9, border: 'none',
                background: (custName.trim() && custUrl.trim() && custKey.trim()) ? T.text : '#EAE7E2',
                color: (custName.trim() && custUrl.trim() && custKey.trim()) ? '#fff' : T.text5,
                font: '600 13px Inter',
                cursor: (custName.trim() && custUrl.trim() && custKey.trim()) ? 'pointer' : 'not-allowed',
              }}>
              保存
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Edit provider form (pre-filled, save without re-test) ──
  if (editProviderId && editingProvider) {
    const { provider: ep, preset } = editingProvider;
    return (
      <div>
        <button onClick={() => setEditProviderId(null)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', marginBottom: 16,
          border: `0.5px solid ${T.border}`, borderRadius: 8,
          background: T.bgCard, font: '500 12px Inter', color: T.text2, cursor: 'pointer',
        }}>
          <Ico p="M19 12H5 M12 19l-7-7 7-7" s={T.text2} sz={14} />返回
        </button>
        <EditProviderForm
          key={editingFormKey}
          provider={ep}
          preset={preset ?? undefined}
          onSave={(config) => handleEditSave(config)}
          onCancel={() => setEditProviderId(null)}
        />
      </div>
    );
  }

  return renderGrid();
}

// ══════════════════════════════════════════════════════════════════════
//  TAB 3: RoutingTab — 三级模型映射
// ══════════════════════════════════════════════════════════════════════

const TIERS = [
  { k: 'light' as const, emoji: '\u{1F33F}', name: '轻量日常', en: 'Lightweight', hint: '适合 Haiku 类快速模型',
    scenes: ['宠物话术生成', '快捷添加解析', '简单问答'] },
  { k: 'medium' as const, emoji: '⚖️', name: '中量级', en: 'Balanced', hint: '适合 Sonnet 类均衡模型',
    scenes: ['聊天对话', 'Cowork 工具调用'] },
  { k: 'complex' as const, emoji: '\u{1F9E0}', name: '复杂任务处理', en: 'Complex', hint: '适合 DeepSeek 类深度推理模型',
    scenes: ['任务智能拆解', '洞察图表分析', '长文推理'] },
];

function RoutingTab() {
  const { providers, tierModels, setTierModel } = useAIStore();
  const lang = useSettingsStore((s) => s.language);

  const modelOptions = useMemo(() => {
    return providers
      .filter((p) => p.apiKey && p.fetchedModels.length > 0)
      .map((p) => ({
        providerId: p.id,
        providerName: p.name,
        models: p.fetchedModels,
      }));
  }, [providers]);

  const anyConfigured = Object.values(tierModels).some(Boolean);

  return (
    <div>
      <div style={{ marginBottom: 6, fontSize: 13, fontWeight: 600, color: T.text }}>模型层级映射</div>
      <div style={{ marginBottom: 16, fontSize: 12, color: T.text3, lineHeight: 1.6 }}>
        为不同复杂度的任务指定最合适的模型，阿夏会自动路由。<br />
        {lang === 'zh' ? '未配置的层级将自动回退到当前活跃供应商。' : 'Unconfigured tiers fall back to the active provider.'}
      </div>

      {/* 映射关系示意图 */}
      <div style={{
        display: 'flex', alignItems: 'stretch', gap: 0, marginBottom: 16,
        border: `0.5px solid ${T.border}`, borderRadius: 10, overflow: 'hidden',
        fontSize: 11, textAlign: 'center',
      }}>
        {TIERS.map((tier, i) => (
          <div key={tier.k} style={{
            flex: 1, padding: '10px 6px',
            borderRight: i < TIERS.length - 1 ? `0.5px solid ${T.border}` : 'none',
            background: tierModels[tier.k] ? `${T.accentDim}50` : 'transparent',
          }}>
            <div style={{ fontSize: 16, marginBottom: 2 }}>{tier.emoji}</div>
            <div style={{ fontWeight: 600, color: T.text, marginBottom: 2 }}>{tier.name}</div>
            <div style={{ color: T.text4, fontSize: 10, lineHeight: 1.4 }}>
              {tier.scenes.map((s, j) => <span key={j}>{s}{j < tier.scenes.length - 1 ? ' / ' : ''}</span>)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        {TIERS.map((tier) => (
          <TierCard
            key={tier.k}
            tier={tier}
            value={tierModels[tier.k]}
            modelOptions={modelOptions}
            onChange={(v) => setTierModel(tier.k, v)}
          />
        ))}
      </div>
      {!anyConfigured && (
        <div style={{ marginTop: 14, fontSize: 12, fontStyle: 'italic', color: T.text5 }}>
          请先在「供应商」标签配置 API Key 并获取模型列表。
        </div>
      )}
    </div>
  );
}

function TierCard({ tier, value, modelOptions, onChange }: {
  tier: typeof TIERS[number];
  value: string;
  modelOptions: { providerId: string; providerName: string; models: string[] }[];
  onChange: (v: string) => void;
}) {
  const [focus, setFocus] = useState(false);
  const set = !!value;
  const prov = set ? value.split('::')[0] : null;
  const provName = set && prov
    ? modelOptions.find((m) => m.providerId === prov)?.providerName ?? null
    : null;
  const modelDisplay = set && value.includes('::') ? value.split('::')[1] : value;

  return (
    <div style={{
      flex: 1, minWidth: 0, position: 'relative', borderRadius: 12,
      border: set
        ? `1.5px solid ${T.accent}`
        : focus
          ? `1.5px solid ${T.accent}`
          : `1.5px dashed ${T.border}`,
      background: set ? T.accentDim : T.bg,
      padding: '16px 14px', transition: 'border-color .16s, background .16s',
    }}>
      {set && (
        <span style={{
          position: 'absolute', top: 10, right: 10,
          width: 20, height: 20, borderRadius: '50%',
          background: T.green, color: '#fff',
          display: 'grid', placeItems: 'center',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.2 4.5L19 7" />
          </svg>
        </span>
      )}
      <div style={{ fontSize: 24, lineHeight: 1, marginBottom: 10 }}>{tier.emoji}</div>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: T.text, marginBottom: 2 }}>{tier.name}</div>
      <div style={{ fontSize: 11, color: T.text5, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 14 }}>{tier.en}</div>

      <div style={{ position: 'relative' }}>
        <select
          value={set ? value : ''}
          onChange={(e) => onChange(e.target.value || '')}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            width: '100%', appearance: 'none', font: 'inherit', fontSize: 13,
            color: set ? T.text : T.text3, background: T.bgCard,
            border: `0.5px solid ${focus ? T.accent : T.border}`,
            boxShadow: focus ? '0 0 0 3px rgba(217,119,87,.12)' : 'none',
            borderRadius: 9, padding: '9px 30px 9px 12px',
            cursor: 'pointer', transition: 'all .14s',
          }}>
          <option value="">-- 点击选择模型 --</option>
          {modelOptions.map((g) => (
            <optgroup key={g.providerId} label={g.providerName}>
              {g.models.map((m) => (
                <option key={`${g.providerId}::${m}`} value={`${g.providerId}::${m}`}>{m}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <span style={{
          position: 'absolute', right: 10, top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none', color: T.text3,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>

      <div style={{ marginTop: 12, minHeight: 22 }}>
        {set ? (
          provName ? (
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 99,
              background: '#F2EFEA', color: T.text2,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.text5, display: 'inline-block' }} />
              {provName} / {modelDisplay}
            </span>
          ) : (
            <span style={{ fontSize: 11.5, color: T.text5 }}>模型已移除，请重新选择</span>
          )
        ) : (
          <span style={{ fontSize: 11.5, color: T.text5 }}>尚未指定模型</span>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  TAB 4: PermissionsTab — 模型权限矩阵
// ══════════════════════════════════════════════════════════════════════

const TIERS_LIST: PermissionTier[] = [0, 1, 2, 3, 4];

function PermissionsTab() {
  const lang = useSettingsStore((s) => s.language);
  const providers = useAIStore((s) => s.providers);
  const activeProviderId = useAIStore((s) => s.activeChatProviderId);
  const { getOrCreateProfile, setTier, resetProfile } = usePermissionStore();

  // All provider+model combos available for chat
  const configured = useMemo(() => {
    const list: { compositeKey: string; label: string }[] = [];
    for (const p of providers) {
      if (!p.apiKey || !p.enabled) continue;
      const models = p.selectedModels.length > 0 ? p.selectedModels : p.fetchedModels;
      for (const m of models) {
        list.push({ compositeKey: `${p.id}::${m}`, label: `${m} (${p.name})` });
      }
    }
    return list;
  }, [providers]);

  const [selected, setSelected] = useState('');
  useEffect(() => {
    if (!selected && configured.length > 0) {
      setSelected(configured[0].compositeKey);
    }
  }, [configured, selected]);

  const profileTiers = useMemo(() => {
    if (!selected) return DEFAULT_TIERS;
    return getOrCreateProfile(selected).tiers;
  }, [selected, getOrCreateProfile]);

  const handleSetTier = (domain: Domain, tier: number) => {
    if (!selected) return;
    setTier(selected, domain, tier as PermissionTier);
  };

  const empty = configured.length === 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
            {lang === 'zh' ? '模型权限设置' : 'Model Permissions'}
          </div>
          <div style={{ fontSize: 12, color: T.text3, marginTop: 2 }}>
            {lang === 'zh' ? '配置各模型对数据域的访问权限层级' : 'Configure domain access tiers for each model'}
          </div>
        </div>
        {selected && (
          <button onClick={() => { resetProfile(selected); }} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8, border: `0.5px solid ${T.border}`,
            background: T.bgCard, font: '500 12px Inter', color: T.text2, cursor: 'pointer',
          }}>
            <Ico p="M1 4v6h6 M23 20v-6h-6" s={T.text3} sz={14} />
            {lang === 'zh' ? '恢复默认' : 'Reset to Defaults'}
          </button>
        )}
      </div>

      {/* Model selector */}
      <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: T.text2 }}>
          {lang === 'zh' ? '选择模型' : 'Select model'}
        </label>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}
          style={{
            width: '100%', maxWidth: 420, padding: '9px 12px', borderRadius: 9,
            border: `0.5px solid ${T.border}`, background: T.bgCard,
            font: '13px Inter, sans-serif', color: T.text, outline: 'none', cursor: 'pointer',
          }}>
          {empty && <option value="">{lang === 'zh' ? '暂无可用模型' : 'No models available'}</option>}
          {configured.map((c) => (
            <option key={c.compositeKey} value={c.compositeKey}>{c.label}</option>
          ))}
        </select>
      </div>

      {empty ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: T.text3, fontSize: 13 }}>
          {lang === 'zh'
            ? '请先在「供应商管理」标签页配置并启用至少一个 AI 供应商，配置完成后可在此为每个模型精细化控制各数据域的访问权限。'
            : 'Configure at least one AI provider in the Providers tab first, then fine-tune each model\'s domain permissions here.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead>
              <tr>
                <th style={{ ...thSt, textAlign: 'left', width: 140 }}>{lang === 'zh' ? '数据域' : 'Domain'}</th>
                {TIERS_LIST.map((t) => (
                  <th key={t} style={{ ...thSt, textAlign: 'center', width: 80 }}>
                    {lang === 'zh' ? TIER_LABELS[t].zh : TIER_LABELS[t].en}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_DOMAINS.map((domain) => {
                const cls = DOMAIN_CLASSIFICATIONS.find((c) => c.domain === domain)!;
                const current = profileTiers[domain];
                const isSettings = domain === 'settings';
                return (
                  <tr key={domain} style={{ borderTop: `0.5px solid ${T.border}`, opacity: isSettings ? 0.5 : 1 }}>
                    <td style={{
                      padding: '10px 14px', fontSize: 12.5, fontWeight: 500, color: T.text,
                      whiteSpace: 'nowrap',
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {lang === 'zh' ? cls.descriptionZh : cls.descriptionEn}
                        {isSettings && (
                          <span style={{
                            fontSize: 9, padding: '1px 5px', borderRadius: 99,
                            background: '#F0EDE8', color: T.text4, fontWeight: 600,
                          }}>
                            {lang === 'zh' ? '锁定' : 'locked'}
                          </span>
                        )}
                      </span>
                    </td>
                    {TIERS_LIST.map((tier) => {
                      const isOn = current === tier;
                      const disabled = isSettings && tier !== 0;
                      return (
                        <td key={`${domain}-${tier}`} style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <button
                            disabled={disabled}
                            onClick={() => handleSetTier(domain, tier)}
                            title={lang === 'zh' ? TIER_LABELS[tier].zh : TIER_LABELS[tier].en}
                            style={{
                              width: 28, height: 28, borderRadius: 14, border: 'none', cursor: disabled ? 'default' : 'pointer',
                              background: isOn ? T.accent : 'transparent',
                              transition: 'background .14s',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              opacity: disabled ? 0.3 : 1,
                            }}
                            onMouseEnter={(e) => { if (!isOn && !disabled) (e.currentTarget as HTMLElement).style.background = T.bgTint; }}
                            onMouseLeave={(e) => { if (!isOn) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            {isOn && <Ico p="M5 12l4 4 10-10" s="#fff" sz={12} />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Tier descriptions */}
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {TIERS_LIST.map((t) => (
              <div key={t} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11, color: T.text3,
              }}>
                <span style={{
                  width: 10, height: 10, borderRadius: 5, flex: 'none',
                  background: t === 0 ? '#D6D3CE' : T.accent,
                  opacity: t === 0 ? 0.5 : 1,
                }} />
                <span style={{ fontWeight: 600, color: T.text2 }}>
                  {lang === 'zh' ? TIER_LABELS[t].zh : TIER_LABELS[t].en}
                </span>
                <span>—</span>
                <span>{lang === 'zh'
                  ? ([
                    '完全无访问权限',
                    '可读取数据，不可修改',
                    '可读写，写操作需确认',
                    '可读写，写操作自动执行',
                    '完全访问含删除',
                  ])[t]
                  : ([
                    'No access at all',
                    'Read data, no modifications',
                    'Read + propose writes, confirm needed',
                    'Read + auto-execute writes',
                    'Full access including destructive ops',
                  ])[t]
                }</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  Main AISettings — 4-tab layout
// ══════════════════════════════════════════════════════════════════════

type TabKey = 'stats' | 'providers' | 'routing' | 'permissions';

const MAIN_TABS: { k: TabKey; label: string; icon: string }[] = [
  { k: 'stats',       label: '模型日志',   icon: 'M3 3v18h18 M7 14l3-3 3 3 5-5' },
  { k: 'providers',   label: '供应商管理',  icon: 'M5 12h14 M12 5v14' },
  { k: 'routing',     label: '路由映射',   icon: 'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7' },
  { k: 'permissions', label: '权限管理',   icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
];

export default function AISettings() {
  const [tab, setTab] = useState<TabKey>('stats');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
      <Segmented
        value={tab}
        onChange={(k) => setTab(k as TabKey)}
        options={MAIN_TABS}
      />

      {tab === 'stats' && <UsageStats />}
      {tab === 'providers' && <ProviderConfigTab />}
      {tab === 'routing' && <RoutingTab />}
      {tab === 'permissions' && <PermissionsTab />}
    </div>
  );
}
