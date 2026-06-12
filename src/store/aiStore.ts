import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getProvider } from '../lib/ai/providers';

/**
 * aiStore — AI 能力配置
 *
 * aiEnabled 是「自我升级」总开关：默认关闭，app 表现为纯本地待办工具；
 * 用户在 设置→AI 实验室 开启并配好任一厂商 key 后，
 * 界面才出现任务拆解等 AI 入口。
 *
 * petVisible 独立于 aiEnabled，默认 true，无需 API key 即可显示 Asha 宠物。
 *
 * 隐私边界：API key 仅存本机 localStorage（zustand persist），
 * 不上传任何服务器；请求直连用户所选厂商。
 */

export interface ProviderConfig {
  apiKey: string;
  model: string;
}

interface AIState {
  aiEnabled: boolean;
  /** 宠物 Asha 独立开关：默认开，不依赖 AI API */
  petVisible: boolean;
  /** providerId → 用户配置 */
  configs: Record<string, ProviderConfig>;
  activeProviderId: string;

  setAiEnabled: (v: boolean) => void;
  setPetVisible: (v: boolean) => void;
  setProviderConfig: (id: string, config: Partial<ProviderConfig>) => void;
  setActiveProvider: (id: string) => void;
}

export const useAIStore = create<AIState>()(
  persist(
    (set) => ({
      aiEnabled: false,
      petVisible: true,
      configs: {},
      activeProviderId: 'deepseek',

      setAiEnabled: (aiEnabled) => set({ aiEnabled }),
      setPetVisible: (petVisible) => set({ petVisible }),

      setProviderConfig: (id, config) =>
        set((s) => {
          const prev = s.configs[id] ?? { apiKey: '', model: getProvider(id)?.presetModels[0] ?? '' };
          return { configs: { ...s.configs, [id]: { ...prev, ...config } } };
        }),

      setActiveProvider: (activeProviderId) => set({ activeProviderId }),
    }),
    { name: 'todoapp-ai', version: 1 }
  )
);

/** 当前激活厂商的可用配置；未配 key 时返回 null（调用方据此引导去设置） */
export function getActiveAIConfig(): { providerId: string; model: string; apiKey: string } | null {
  const { configs, activeProviderId, aiEnabled } = useAIStore.getState();
  if (!aiEnabled) return null;
  const cfg = configs[activeProviderId];
  if (!cfg?.apiKey) return null;
  const model = cfg.model || getProvider(activeProviderId)?.presetModels[0] || '';
  if (!model) return null;
  return { providerId: activeProviderId, model, apiKey: cfg.apiKey };
}

/** 已填 key 的厂商列表（聊天面板模型切换下拉用） */
export function getConfiguredProviders(): { providerId: string; model: string }[] {
  const { configs } = useAIStore.getState();
  return Object.entries(configs)
    .filter(([, c]) => !!c.apiKey)
    .map(([id, c]) => ({ providerId: id, model: c.model || getProvider(id)?.presetModels[0] || '' }));
}
