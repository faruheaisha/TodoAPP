import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { localDateKey } from '../lib/utils';

export type FocusMode = 'work' | 'shortBreak' | 'longBreak';

export interface SessionLogEntry {
  date: string;
  minutes: number;
}

export interface FocusSettings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: FocusSettings = {
  workMinutes: 40,
  shortBreakMinutes: 10,
  longBreakMinutes: 20,
  longBreakInterval: 4,
  soundEnabled: true,
};

function durationFor(mode: FocusMode, settings: FocusSettings): number {
  switch (mode) {
    case 'work': return settings.workMinutes * 60;
    case 'shortBreak': return settings.shortBreakMinutes * 60;
    case 'longBreak': return settings.longBreakMinutes * 60;
  }
}

interface FocusState {
  settings: FocusSettings;
  mode: FocusMode;
  remainingSeconds: number;
  isRunning: boolean;
  /** 精确倒计时：记录当前段应结束的时间戳（ms），消除 setInterval 漂移 */
  endTimestamp: number | null;
  completedWorkSessions: number;
  cycleCount: number;
  linkedTodoId: string | null;
  /** 已完成 session 日志（每次完成时记录 settings.workMinutes） */
  sessionLog: SessionLogEntry[];
  /** 按日累计实际专注分钟（每次 tick 实时累加），用于统计图 */
  dailyFocusMinutes: Record<string, number>;
  /** 记录上一个 tick 的时间戳（ms），用于计算本次 tick 的增量 */
  lastTickTime: number | null;

  /** 循环模式: 'off' | 'cycle'（N次后停） | 'infinite' */
  loopMode: 'off' | 'cycle' | 'infinite';
  /** 周期循环次数（仅 loopMode='cycle' 生效） */
  loopCycles: number;
  /** 当前循环剩余次数（每次 work→break 递减） */
  remainingCycles: number;
  /** 退出时暂停标记（仅 session 内有效，不持久化） */
  pausedOnExit: boolean;

  updateSettings: (updates: Partial<FocusSettings>) => void;
  setLoopMode: (v: 'off' | 'cycle' | 'infinite') => void;
  setLoopCycles: (v: number) => void;
  setPausedOnExit: (v: boolean) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  /** 由外部 rAF/interval 调用，传入当前时间戳以实现真实时间驱动 */
  tick: (now?: number) => void;
  switchMode: (mode: FocusMode) => void;
  setLinkedTodo: (id: string | null) => void;
}

export const useFocusStore = create<FocusState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      mode: 'work',
      remainingSeconds: DEFAULT_SETTINGS.workMinutes * 60,
      isRunning: false,
      endTimestamp: null,
      completedWorkSessions: 0,
      cycleCount: 0,
      linkedTodoId: null,
      sessionLog: [],
      dailyFocusMinutes: {},
      lastTickTime: null,
      loopMode: 'off',
      loopCycles: 4,
      remainingCycles: 4,
      pausedOnExit: false,

      setLoopMode: (v) => set((s) => ({ loopMode: v, remainingCycles: v === 'cycle' ? s.loopCycles : 0 })),
      setLoopCycles: (v) => set((s) => ({ loopCycles: Math.max(2, v), remainingCycles: s.loopMode === 'cycle' ? Math.max(2, v) : s.remainingCycles })),
      setPausedOnExit: (v) => set({ pausedOnExit: v }),

      updateSettings: (updates) => {
        const settings = { ...get().settings, ...updates };
        const { isRunning, mode, endTimestamp } = get();
        // 休息中设置该休息类型的时长 → 即时刷新倒计时
        // 专注中设置专注时长 → 不刷新（下一轮生效）
        const shouldRefresh =
          (mode === 'shortBreak' && 'shortBreakMinutes' in updates) ||
          (mode === 'longBreak'  && 'longBreakMinutes'  in updates);
        set((state) => ({
          settings,
          remainingSeconds: shouldRefresh
            ? durationFor(mode, settings)
            : (isRunning ? state.remainingSeconds : durationFor(state.mode, settings)),
          endTimestamp: shouldRefresh ? Date.now() + durationFor(mode, settings) * 1000 : endTimestamp,
        }));
      },

      start: () => {
        const { remainingSeconds } = get();
        set({ isRunning: true, endTimestamp: Date.now() + remainingSeconds * 1000, lastTickTime: Date.now() });
      },

      pause: () => {
        const { endTimestamp } = get();
        const remaining = endTimestamp
          ? Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000))
          : get().remainingSeconds;
        set({ isRunning: false, endTimestamp: null, remainingSeconds: remaining, lastTickTime: null });
      },

      reset: () => {
        const { mode, settings, loopMode, loopCycles } = get();
        set({ isRunning: false, endTimestamp: null, remainingSeconds: durationFor(mode, settings), lastTickTime: null, remainingCycles: loopMode === 'cycle' ? loopCycles : 0 });
      },

      tick: (now = Date.now()) => {
        const { isRunning, endTimestamp, mode } = get();
        if (!isRunning || endTimestamp === null) return;

        const remaining = Math.max(0, Math.ceil((endTimestamp - now) / 1000));

        // ── 实时累计专注分钟（仅在 work 模式下记录） ──
        let dailyFocusMinutes = get().dailyFocusMinutes;
        if (mode === 'work') {
          const { lastTickTime } = get();
          if (lastTickTime !== null && now > lastTickTime) {
            const elapsedSec = (now - lastTickTime) / 1000;
            if (elapsedSec < 60) {
              const todayKey = localDateKey();
              const current = dailyFocusMinutes[todayKey] ?? 0;
              dailyFocusMinutes = { ...dailyFocusMinutes, [todayKey]: current + elapsedSec / 60 };
            }
          }
        }

        set({ remainingSeconds: remaining, lastTickTime: now, dailyFocusMinutes });

        if (remaining > 0) return;

        // ── Phase complete ──
        const { settings, completedWorkSessions, cycleCount, linkedTodoId, loopMode, loopCycles, remainingCycles } = get();
        let nextMode: FocusMode = 'work';
        let nextCompleted = completedWorkSessions;
        let nextCycle = cycleCount;
        let nextRemainingCycles = remainingCycles;
        let nextSessionLog = get().sessionLog;
        let stop = false;

        if (mode === 'work') {
          nextCompleted = completedWorkSessions + 1;
          nextCycle = cycleCount + 1;

          if (loopMode === 'infinite') {
            // 无限循环：work→shortBreak→work→shortBreak...
            nextMode = 'shortBreak';
          } else if (loopMode === 'cycle') {
            // 周期循环：work→shortBreak→work→shortBreak→... × N 次后停止
            nextRemainingCycles = Math.max(0, remainingCycles - 1);
            if (nextRemainingCycles <= 0) {
              stop = true;
            } else {
              nextMode = 'shortBreak';
            }
          } else {
            // 标准模式：work→shortBreak→work×N→longBreak→停止
            nextMode = nextCycle >= settings.longBreakInterval ? 'longBreak' : 'shortBreak';
            if (nextMode === 'longBreak') nextCycle = 0;
          }

          const todayKey = localDateKey();
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 90);
          const cutoffKey = localDateKey(cutoff);
          nextSessionLog = [...nextSessionLog.filter(e => e.date >= cutoffKey),
            { date: todayKey, minutes: settings.workMinutes }];
        }

        window.dispatchEvent(new CustomEvent('focus-session-complete', {
          detail: { finishedMode: mode, nextMode, linkedTodoId },
        }));

        if (stop) {
          set({
            mode: nextMode,
            remainingSeconds: durationFor(nextMode, settings),
            isRunning: false,
            endTimestamp: null,
            completedWorkSessions: nextCompleted,
            cycleCount: nextCycle,
            sessionLog: nextSessionLog,
            remainingCycles: nextRemainingCycles,
          });
          return;
        }

        const nextDuration = durationFor(nextMode, settings);
        set({
          mode: nextMode,
          remainingSeconds: nextDuration,
          endTimestamp: Date.now() + nextDuration * 1000,
          isRunning: true,
          completedWorkSessions: nextCompleted,
          cycleCount: nextCycle,
          sessionLog: nextSessionLog,
          remainingCycles: nextRemainingCycles,
        });
      },

      switchMode: (mode) => {
        const { settings } = get();
        set({ mode, isRunning: false, endTimestamp: null, remainingSeconds: durationFor(mode, settings) });
      },

      setLinkedTodo: (id) => set({ linkedTodoId: id }),
    }),
    {
      name: 'todoapp-focus',
      version: 4,
      migrate: (persisted, version) => {
        // v3→v4: loopEnabled boolean → loopMode tri-state + loopCycles
        if (version < 4) {
          const p = persisted as any;
          return {
            ...p,
            loopMode: p?.loopEnabled ? 'infinite' : 'off',
            loopCycles: 4,
            settings: DEFAULT_SETTINGS,
          };
        }
        // 首次打开（无缓存）用代码默认值
        return persisted as object;
      },
      partialize: (state) => ({
        settings: state.settings,
        mode: state.mode,
        remainingSeconds: state.remainingSeconds,
        completedWorkSessions: state.completedWorkSessions,
        cycleCount: state.cycleCount,
        sessionLog: state.sessionLog,
        dailyFocusMinutes: state.dailyFocusMinutes,
        loopMode: state.loopMode,
        loopCycles: state.loopCycles,
      }),
      merge: (persisted, current) => {
        const p = persisted as any;
        return {
          ...current,
          ...p,
          isRunning: false,
          endTimestamp: null,
          lastTickTime: null,
          pausedOnExit: false,
          remainingCycles: p?.loopMode === 'cycle' ? (p?.loopCycles ?? 4) : 0,
        };
      },
    }
  )
);

export { DEFAULT_SETTINGS as FOCUS_DEFAULT_SETTINGS, durationFor as focusDurationFor };
