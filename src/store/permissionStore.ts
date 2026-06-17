/**
 * permissionStore.ts — 每模型权限配置存储
 *
 * 持久化记录每个模型（compositeKey）对各数据域的权限层级。
 * 未配置的模型走 DEFAULT_PROFILE，生成时参考 DOMAIN_CLASSIFICATIONS。
 *
 * 注意：不与 tools.ts 互导（避免循环依赖），工具权限判断放在 tools.ts 中。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ALL_DOMAINS, type Domain } from '../lib/ai/privacy';

export type PermissionTier = 0 | 1 | 2 | 3 | 4;

/** 工具权限描述（与 tools.ts ToolPermission 同步的结构，但在此定义避免循环依赖） */
export interface ToolPermission {
  domain: Domain;
  minTier: number;
}

export const TIER_LABELS: Record<PermissionTier, { zh: string; en: string }> = {
  0: { zh: '拒绝', en: 'Denied' },
  1: { zh: '只读', en: 'Read' },
  2: { zh: '建议', en: 'Suggest' },
  3: { zh: '信任', en: 'Trusted' },
  4: { zh: '管理', en: 'Admin' },
};

/** 默认权限：数据域 suggest(2) / navigation+stats+logs read(1) / settings denied(0) */
export const DEFAULT_TIERS: Record<Domain, PermissionTier> = {
  todos: 2,
  subtasks: 2,
  tags: 2,
  habits: 2,
  notes: 2,
  music: 2,
  recurrence: 2,
  navigation: 1,
  stats: 1,
  appearance: 2,
  schedule: 2,
  backup: 2,
  logs: 1,
  settings: 0,
};

export interface PermissionProfile {
  /** "providerId::modelName" */
  compositeKey: string;
  tiers: Record<Domain, PermissionTier>;
}

interface PermissionState {
  profiles: PermissionProfile[];
  /** 获取某模型的权限配置，不存在则用默认创建 */
  getOrCreateProfile: (compositeKey: string) => PermissionProfile;
  /** 修改某模型某域的权限 */
  setTier: (compositeKey: string, domain: Domain, tier: PermissionTier) => void;
  /** 获取某模型某域的有效权限级（若无配置则用默认） */
  getEffectiveTier: (compositeKey: string, domain: Domain) => PermissionTier;
  /** 判断工具是否可执行：tiers[domain] >= minTier */
  canExecute: (compositeKey: string, tp: ToolPermission) => boolean;
  /** 重置某模型为默认 */
  resetProfile: (compositeKey: string) => void;
}

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set, get) => ({
      profiles: [],

      getOrCreateProfile: (compositeKey) => {
        const state = get();
        let existing = state.profiles.find((p) => p.compositeKey === compositeKey);
        if (!existing) {
          existing = { compositeKey, tiers: { ...DEFAULT_TIERS } };
          set({ profiles: [...state.profiles, existing] });
        }
        return existing;
      },

      setTier: (compositeKey, domain, tier) => {
        const state = get();
        // settings 域永远拒绝
        const safeTier = domain === 'settings' ? 0 : tier;
        const idx = state.profiles.findIndex((p) => p.compositeKey === compositeKey);
        if (idx >= 0) {
          const updated = [...state.profiles];
          updated[idx] = {
            ...updated[idx],
            tiers: { ...updated[idx].tiers, [domain]: safeTier as PermissionTier },
          };
          set({ profiles: updated });
        } else {
          const tiers = { ...DEFAULT_TIERS, [domain]: safeTier as PermissionTier };
          set({ profiles: [...state.profiles, { compositeKey, tiers }] });
        }
      },

      getEffectiveTier: (compositeKey, domain) => {
        const state = get();
        const profile = state.profiles.find((p) => p.compositeKey === compositeKey);
        return profile ? (profile.tiers[domain] ?? DEFAULT_TIERS[domain]) : DEFAULT_TIERS[domain];
      },

      canExecute: (compositeKey, tp) => {
        const tier = get().getEffectiveTier(compositeKey, tp.domain);
        return (tier as number) >= tp.minTier;
      },

      resetProfile: (compositeKey) => {
        set((s) => ({
          profiles: s.profiles.map((p) =>
            p.compositeKey === compositeKey ? { ...p, tiers: { ...DEFAULT_TIERS } } : p
          ),
        }));
      },
    }),
    { name: 'todoapp-permissions', version: 1 }
  )
);
