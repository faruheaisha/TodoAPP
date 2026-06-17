import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * timerStore — 独立计时器（P2.2，与番茄钟解耦）
 *
 * 支持多个并行计时器：正计时（stopwatch）与倒计时（countdown）。
 * 与 focusStore 同一套时间戳驱动方案：运行中只存锚点时间戳，
 * UI 按需采样换算，杀进程/休眠后仍准确；运行态不持久化（重启即暂停）。
 */

export type TimerMode = 'countdown' | 'stopwatch';

export interface TimerItem {
  id: string;
  label: string;
  mode: TimerMode;
  /** countdown：目标时长（秒） */
  durationSec: number;
  /** 已累计的秒数（暂停时落账） */
  accumulatedSec: number;
  /** 运行锚点（ms），null = 暂停 */
  anchorTs: number | null;
}

/** 计算计时器当前显示秒数（countdown 为剩余，stopwatch 为累计） */
export function timerCurrentSec(item: TimerItem, now = Date.now()): number {
  const running = item.anchorTs !== null ? (now - item.anchorTs) / 1000 : 0;
  const elapsed = item.accumulatedSec + running;
  return item.mode === 'countdown'
    ? Math.max(0, Math.ceil(item.durationSec - elapsed))
    : Math.floor(elapsed);
}

interface TimerState {
  timers: TimerItem[];
  sectionsReversed: boolean;
  addTimer: (mode: TimerMode, durationSec: number, label?: string) => void;
  setSectionsReversed: (v: boolean) => void;
  removeTimer: (id: string) => void;
  startTimer: (id: string) => void;
  pauseTimer: (id: string) => void;
  resetTimer: (id: string) => void;
  /** countdown 到点后由 UI 调用落账归零 */
  finishTimer: (id: string) => void;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set) => ({
      timers: [],
      sectionsReversed: false,

      setSectionsReversed: (v) => set({ sectionsReversed: v }),

      addTimer: (mode, durationSec, label = '') =>
        set((s) => ({
          timers: [
            ...s.timers,
            {
              id: crypto.randomUUID(),
              label,
              mode,
              durationSec,
              accumulatedSec: 0,
              anchorTs: null,
            },
          ],
        })),

      removeTimer: (id) => set((s) => ({ timers: s.timers.filter((t) => t.id !== id) })),

      startTimer: (id) =>
        set((s) => ({
          timers: s.timers.map((t) => (t.id === id && t.anchorTs === null ? { ...t, anchorTs: Date.now() } : t)),
        })),

      pauseTimer: (id) =>
        set((s) => ({
          timers: s.timers.map((t) => {
            if (t.id !== id || t.anchorTs === null) return t;
            return { ...t, accumulatedSec: t.accumulatedSec + (Date.now() - t.anchorTs) / 1000, anchorTs: null };
          }),
        })),

      resetTimer: (id) =>
        set((s) => ({
          timers: s.timers.map((t) => (t.id === id ? { ...t, accumulatedSec: 0, anchorTs: null } : t)),
        })),

      finishTimer: (id) =>
        set((s) => ({
          timers: s.timers.map((t) =>
            t.id === id ? { ...t, accumulatedSec: t.durationSec, anchorTs: null } : t
          ),
        })),
    }),
    {
      name: 'todoapp-timers',
      version: 1,
      // 运行态不持久化：重启后全部回到暂停（锚点时间戳跨进程无意义）
      merge: (persisted, current) => {
        const p = persisted as Partial<TimerState> | undefined;
        return {
          ...current,
          timers: (p?.timers ?? []).map((t) => ({ ...t, anchorTs: null })),
        };
      },
    }
  )
);
