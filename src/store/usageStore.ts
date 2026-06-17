import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UsageRecord {
  id: string;
  ts: number;
  providerId: string;
  model: string;
  source: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  status: number;
  ttfb: number;
  dur: number;
  cost: number;
}

export interface DailyBucket {
  date: string;
  label: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  requests: number;
}

export interface Summary {
  realTotal: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  requests: number;
  successRate: number;
  cacheHitRate: number;
}

export interface ProviderStat {
  providerId: string;
  name: string;
  logo: string;
  color: string;
  cn: string;
  requests: number;
  tokens: number;
  cost: number;
  avgCost: number;
  successRate: number;
  avgLatency: number;
}

export interface ModelStat {
  model: string;
  providerId: string;
  requests: number;
  tokens: number;
  cost: number;
  avgCost: number;
  color: string;
}

// ── 颜色语义 ──
export const TONE = {
  input:    '#6a9bcc',
  output:   '#d97757',
  cacheRead:  '#788c5d',
  cacheWrite: '#c46686',
  cost:     '#a0a09c',
} as const;

// ── 格式工具 ──
export function fmtInt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

export function fmtUsd(n: number, dec = 4): string {
  if (n < 0.0001) return '<0.0001';
  return '$' + n.toFixed(dec);
}

export function fmtTokensShort(n: number, _dec = 1): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export function costOf(input: number, output: number, _cacheRead: number, _cacheWrite: number): number {
  return input * 0.000001 + output * 0.000002;
}

const LOGO_EXT: Record<string, string> = {
  apikeyfun:'png',apinebula:'png',atlascloud:'png',byteplus:'png',
  cherryin:'png',claudecn:'png',eflowcode:'png',hermes:'png',
  huoshan:'png',pateway:'jpg',pipellm:'png',relaxcode:'png',
  runapi:'jpg',sudocode:'png',unity2:'png',
};
export function logoUrl(slug: string): string {
  const ext = LOGO_EXT[slug] || 'svg';
  return '/logos/' + slug + '.' + ext;
}

// ── 厂商注册表（从 providers.ts 重新导出） ──
export {
  PROVIDERS, getProvider, getDefaultModels, MODELS_BY_PROVIDER,
  type ProviderDef,
} from '../lib/ai/providers';

import { PROVIDERS as _PROVIDERS } from '../lib/ai/providers';
export const PROVIDER_BY_ID: Record<string, { name: string; logo: string; baseUrl: string; cn: string; color: string }> = {};
for (const p of _PROVIDERS) {
  PROVIDER_BY_ID[p.id] = { name: p.name, logo: logoUrl(p.id), baseUrl: p.baseUrl, cn: p.cn || '', color: p.color || '#888' };
}

// ── 聚合 ──
function pipe(records: UsageRecord[]): { bucket: (date: string) => DailyBucket; make: () => DailyBucket } {
  const b = (date: string): DailyBucket => ({
    date, label: date,
    input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, requests: 0,
  });
  const add = (d: DailyBucket, r: UsageRecord) => {
    d.input += r.input; d.output += r.output;
    d.cacheRead += r.cacheRead; d.cacheWrite += r.cacheWrite;
    d.cost += r.cost; d.requests += 1;
    return d;
  };
  return { bucket: (date) => records.filter(r => new Date(r.ts).toISOString().slice(0,10) === date).reduce(add, b(date)), make: () => b('') };
}

export function summarize(records: UsageRecord[]): Summary {
  const init = { realTotal: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, requests: 0, successRate: 100, cacheHitRate: 0 };
  if (!records.length) return init;
  let ok = 0;
  for (const r of records) {
    init.realTotal += r.input + r.output;
    init.input += r.input; init.output += r.output;
    init.cacheRead += r.cacheRead; init.cacheWrite += r.cacheWrite;
    init.cost += r.cost; init.requests += 1;
    if (r.status === 200) ok++;
  }
  init.successRate = init.requests ? (ok / init.requests) * 100 : 100;
  init.cacheHitRate = init.realTotal ? init.cacheRead / (init.realTotal + init.cacheRead) : 0;
  return init;
}

export function trend(records: UsageRecord[], range: string): DailyBucket[] {
  const days: Record<string, DailyBucket> = {};
  for (const r of records) {
    const d = new Date(r.ts).toISOString().slice(0, 10);
    if (!days[d]) days[d] = { date: d, label: d, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, requests: 0 };
    days[d].input += r.input; days[d].output += r.output;
    days[d].cacheRead += r.cacheRead; days[d].cacheWrite += r.cacheWrite;
    days[d].cost += r.cost; days[d].requests += 1;
  }
  const n = range === '7d' ? 7 : range === '30d' ? 30 : 14;
  const arr = Object.entries(days).sort(([a], [b]) => a.localeCompare(b)).slice(-n);
  return arr.map(([, v]) => v);
}

export function providerStats(records: UsageRecord[]): ProviderStat[] {
  const map: Record<string, ProviderStat> = {};
  for (const r of records) {
    if (!map[r.providerId]) {
      const info = PROVIDER_BY_ID[r.providerId] || { name: r.providerId, logo: '', cn: '', color: '#888' };
      map[r.providerId] = { providerId: r.providerId, name: info.name, logo: info.logo, cn: info.cn, color: info.color, requests: 0, tokens: 0, cost: 0, avgCost: 0, successRate: 100, avgLatency: 0 };
    }
    map[r.providerId].requests += 1;
    map[r.providerId].tokens += r.input + r.output;
    map[r.providerId].cost += r.cost;
  }
  return Object.values(map).map(s => ({ ...s, avgCost: s.requests ? s.cost / s.requests : 0 }));
}

export function modelStats(records: UsageRecord[]): ModelStat[] {
  const map: Record<string, { model: string; providerId: string; requests: number; tokens: number; cost: number; avgCost: number; color: string }> = {};
  for (const r of records) {
    if (!map[r.model]) {
      const info = PROVIDER_BY_ID[r.providerId];
      map[r.model] = { model: r.model, providerId: r.providerId, requests: 0, tokens: 0, cost: 0, avgCost: 0, color: info?.color || '#888' };
    }
    map[r.model].requests += 1;
    map[r.model].tokens += r.input + r.output;
    map[r.model].cost += r.cost;
  }
  return Object.values(map).map(s => ({ ...s, avgCost: s.requests ? s.cost / s.requests : 0 }));
}

// ── Store ──

interface UsageState {
  enabled: boolean;
  records: UsageRecord[];
  setEnabled: (v: boolean) => void;
  record: (r: {
    ts: number; providerId: string; model: string; source: string;
    input: number; output: number; cacheRead: number; cacheWrite: number;
    status: number; ttfb: number; dur: number;
  }) => void;
  getLogs: (range: string) => UsageRecord[];
  clearOldRecords: (days: number) => void;
}

export const useUsageStore = create<UsageState>()(
  persist(
    (set, get) => ({
      enabled: false,
      records: [],
      setEnabled: (enabled) => set({ enabled }),
      record: (r) => {
        const id = 'rec_' + r.ts + '_' + Math.random().toString(36).slice(2, 9);
        const cost = costOf(r.input, r.output, r.cacheRead, r.cacheWrite);
        set((s) => ({ records: [...s.records, { ...r, id, cost }] }));
      },
      getLogs: (range) => {
        const { records } = get();
        if (!records.length) return [];
        const now = Date.now();
        const ranges: Record<string, number> = {
          today: new Date().setHours(0,0,0,0),
          '1d': now - 86400_000,
          '7d': now - 7 * 86400_000,
          '30d': now - 30 * 86400_000,
        };
        const since = ranges[range] ?? ranges['7d'];
        return records.filter(r => r.ts >= since);
      },
      clearOldRecords: (days) => {
        const cutoff = Date.now() - days * 86400_000;
        set((s) => ({ records: s.records.filter(r => r.ts >= cutoff) }));
      },
    }),
    {
      name: 'todoapp-usage',
      version: 1,
      partialize: (s: UsageState) => ({ enabled: s.enabled, records: s.records }),
    }
  )
);
