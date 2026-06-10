import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * completionStore — 记录每个 Todo 的完成时间戳
 *
 * 不写入 SQLite，仅通过 Zustand persist (localStorage) 保留，
 * 用于「已完成任务按天分组」功能。
 * 每条 Todo 完成时写入 completionTimes[id]，删除时清除对应条目。
 */

interface CompletionState {
  /** todoId → ISO 完成时间戳 */
  completionTimes: Record<string, string>;
  setCompletionTime: (id: string, iso: string) => void;
  removeCompletionTime: (id: string) => void;
  getCompletionTime: (id: string) => string | null;
}

export const useCompletionStore = create<CompletionState>()(
  persist(
    (set, get) => ({
      completionTimes: {},

      setCompletionTime: (id, iso) =>
        set((state) => ({
          completionTimes: { ...state.completionTimes, [id]: iso },
        })),

      removeCompletionTime: (id) =>
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [id]: _removed, ...rest } = state.completionTimes;
          return { completionTimes: rest };
        }),

      getCompletionTime: (id) => get().completionTimes[id] ?? null,
    }),
    { name: 'todoapp-completions', version: 1 }
  )
);
