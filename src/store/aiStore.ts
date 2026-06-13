import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── 数据模型 ──────────────────────────────────────────────────────────

export interface AIProvider {
  id: string;
  name: string;
  /** OpenAI 兼容端点 base（不含 /chat/completions，不以 / 结尾） */
  baseUrl: string;
  apiKey: string;
  /** 从 GET /v1/models 获取的模型列表；未获取时为空数组 */
  fetchedModels: string[];
  /** 当前选中的模型 */
  activeModel: string;
  enabled: boolean;
  /** kind: 'anthropic' 启用原生 Messages API；其余走 OpenAI 兼容 */
  kind: 'openai' | 'anthropic';
  notes?: string;
  consoleUrl?: string;
  /** 是否为内置预设（不可删除） */
  isPreset: boolean;
  lastTestMs?: number;
  lastTestOk?: boolean;
}

export interface DailyUsage {
  /** YYYY-MM-DD */
  date: string;
  providerId: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

// ── 三级模型映射 ──────────────────────────────────────────────────────
// light=轻量日常(Haiku类), medium=中量级(Sonnet类), complex=复杂任务(DeepSeek类)
// 值格式: "providerId::modelName"，空字符串表示未设置
export interface TierModelMap {
  light: string;    // 轻量日常
  medium: string;   // 中量级
  complex: string;  // 复杂任务处理
}

// ── Store ─────────────────────────────────────────────────────────────

interface AIState {
  aiEnabled: boolean;
  petVisible: boolean;
  /** 运行时拖拽偏移，不持久化 */
  petOffset: { x: number; y: number };

  providers: AIProvider[];
  activeChatProviderId: string;

  /** 三级模型映射（不含硬编码 ID，用户自己配置） */
  tierModels: TierModelMap;

  /** 近 30 天每日用量（每次 chat() 后写入） */
  usageRecords: DailyUsage[];

  // ── actions ──
  setAiEnabled: (v: boolean) => void;
  setPetVisible: (v: boolean) => void;
  setPetOffset: (o: { x: number; y: number }) => void;

  addProvider: (p: Omit<AIProvider, 'id'>) => string;
  updateProvider: (id: string, patch: Partial<AIProvider>) => void;
  deleteProvider: (id: string) => void;
  /** 选择当前激活供应商（旧名 setActiveProvider 保持兼容） */
  setActiveProvider: (id: string) => void;

  setTierModel: (tier: keyof TierModelMap, value: string) => void;

  recordUsage: (providerId: string, input: number, output: number, cached: number) => void;
}

export const useAIStore = create<AIState>()(
  persist(
    (set) => ({
      aiEnabled: false,
      petVisible: true,
      petOffset: { x: 0, y: 0 },

      // 初始空列表 — 用户自己添加，无内置预设
      providers: [],
      activeChatProviderId: '',

      tierModels: { light: '', medium: '', complex: '' },

      usageRecords: [],

      setAiEnabled: (aiEnabled) => set({ aiEnabled }),
      setPetVisible: (petVisible) => set({ petVisible }),
      setPetOffset: (petOffset) => set({ petOffset }),

      addProvider: (p) => {
        const id = 'custom_' + Date.now().toString(36);
        set((s) => ({ providers: [...s.providers, { ...p, id }] }));
        return id;
      },

      updateProvider: (id, patch) =>
        set((s) => ({
          providers: s.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      deleteProvider: (id) =>
        set((s) => {
          const remaining = s.providers.filter((p) => p.id !== id);
          // 清理三级映射中引用了该 providerId 的条目
          const clearTier = (v: string) => v.startsWith(id + '::') ? '' : v;
          return {
            providers: remaining,
            activeChatProviderId:
              s.activeChatProviderId === id
                ? (remaining[0]?.id ?? '')
                : s.activeChatProviderId,
            tierModels: {
              light: clearTier(s.tierModels.light),
              medium: clearTier(s.tierModels.medium),
              complex: clearTier(s.tierModels.complex),
            },
          };
        }),

      setActiveProvider: (activeChatProviderId) => set({ activeChatProviderId }),

      setTierModel: (tier, value) =>
        set((s) => ({ tierModels: { ...s.tierModels, [tier]: value } })),

      recordUsage: (providerId, inputTokens, outputTokens, cachedTokens) =>
        set((s) => {
          const date = new Date().toISOString().slice(0, 10);
          const idx = s.usageRecords.findIndex(
            (r) => r.date === date && r.providerId === providerId
          );
          let records: DailyUsage[];
          if (idx >= 0) {
            records = s.usageRecords.map((r, i) =>
              i === idx
                ? {
                    ...r,
                    requests: r.requests + 1,
                    inputTokens: r.inputTokens + inputTokens,
                    outputTokens: r.outputTokens + outputTokens,
                    cachedTokens: r.cachedTokens + cachedTokens,
                  }
                : r
            );
          } else {
            records = [
              ...s.usageRecords,
              { date, providerId, requests: 1, inputTokens, outputTokens, cachedTokens },
            ];
          }
          // 只保留最近 30 天
          const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
          return { usageRecords: records.filter((r) => r.date >= cutoff) };
        }),
    }),
    {
      name: 'todoapp-ai',
      version: 2,
      partialize: (s) => ({
        aiEnabled: s.aiEnabled,
        petVisible: s.petVisible,
        providers: s.providers,
        activeChatProviderId: s.activeChatProviderId,
        tierModels: s.tierModels,
        usageRecords: s.usageRecords,
      }),
      migrate: (persisted: unknown, version: number) => {
        const p = persisted as Record<string, unknown> | null;
        if (!p) return persisted;
        // v1 → v2: 旧格式有 configs: Record<string,{apiKey,model}>
        if (version < 2 && p.configs && typeof p.configs === 'object') {
          return {
            ...p,
            providers: [],
            activeChatProviderId: '',
            tierModels: { light: '', medium: '', complex: '' },
            usageRecords: [],
          };
        }
        // 确保 tierModels 字段存在（旧版本升级）
        if (!p.tierModels) {
          return { ...p, tierModels: { light: '', medium: '', complex: '' } };
        }
        return persisted;
      },
    }
  )
);

// ── 向下兼容辅助（ChatPanel / workflows 直接调用） ─────────────────────

/** 当前激活供应商完整配置；未启用 AI 或未配 key 返回 null */
export function getActiveAIConfig(): {
  providerId: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  kind: 'openai' | 'anthropic';
} | null {
  const { providers, activeChatProviderId, aiEnabled } = useAIStore.getState();
  if (!aiEnabled) return null;
  const p = providers.find((x) => x.id === activeChatProviderId);
  if (!p?.apiKey || !p.enabled) return null;
  const model = p.activeModel || p.fetchedModels[0] || '';
  if (!model) return null;
  return { providerId: p.id, model, apiKey: p.apiKey, baseUrl: p.baseUrl, kind: p.kind };
}

/** 已配 key 的供应商列表（ChatPanel 模型切换下拉用） */
export function getConfiguredProviders(): { providerId: string; model: string; name: string }[] {
  const { providers } = useAIStore.getState();
  return providers
    .filter((p) => !!p.apiKey && p.enabled)
    .map((p) => ({
      providerId: p.id,
      model: p.activeModel || p.fetchedModels[0] || '',
      name: p.name,
    }));
}
