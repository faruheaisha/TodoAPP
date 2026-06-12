/**
 * quadrantStore — 四象限手动覆盖
 *
 * 用户拖拽任务到不同象限时，同时：
 *  1. 更新 priority（important 轴）
 *  2. 在此 store 记录 manualQuadrant（urgent 轴覆盖）
 *
 * manualQuadrant 会优先于计算出的象限，防止任务因截止日期逻辑
 * 自动"弹回"原来的象限，直到用户主动修改 priority 或 deadline。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type QuadrantId = 'q1' | 'q2' | 'q3' | 'q4';

interface QuadrantState {
  overrides: Record<string, QuadrantId>; // todoId → 手动指定的象限
  setOverride: (todoId: string, q: QuadrantId) => void;
  clearOverride: (todoId: string) => void;
  clearAll: () => void;
}

export const useQuadrantStore = create<QuadrantState>()(
  persist(
    (set) => ({
      overrides: {},
      setOverride: (todoId, q) =>
        set((s) => ({ overrides: { ...s.overrides, [todoId]: q } })),
      clearOverride: (todoId) =>
        set((s) => {
          const { [todoId]: _removed, ...rest } = s.overrides;
          return { overrides: rest };
        }),
      clearAll: () => set({ overrides: {} }),
    }),
    { name: 'todoapp-quadrant-overrides' }
  )
);
