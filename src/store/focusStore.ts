import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useOverlayStore } from './overlayStore';

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
  autoStartNext: boolean;
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: FocusSettings = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartNext: false,
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
  sessionLog: SessionLogEntry[];

  updateSettings: (updates: Partial<FocusSettings>) => void;
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

      updateSettings: (updates) => {
        const settings = { ...get().settings, ...updates };
        set((state) => ({
          settings,
          remainingSeconds: state.isRunning ? state.remainingSeconds : durationFor(state.mode, settings),
        }));
      },

      start: () => {
        const { remainingSeconds } = get();
        set({ isRunning: true, endTimestamp: Date.now() + remainingSeconds * 1000 });
      },

      pause: () => {
        // Save accurate remaining time before clearing endTimestamp
        const { endTimestamp } = get();
        const remaining = endTimestamp
          ? Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000))
          : get().remainingSeconds;
        set({ isRunning: false, endTimestamp: null, remainingSeconds: remaining });
      },

      reset: () => {
        const { mode, settings } = get();
        set({ isRunning: false, endTimestamp: null, remainingSeconds: durationFor(mode, settings) });
      },

      tick: (now = Date.now()) => {
        const { isRunning, endTimestamp } = get();
        if (!isRunning || endTimestamp === null) return;

        const remaining = Math.max(0, Math.ceil((endTimestamp - now) / 1000));

        // Update display
        set({ remainingSeconds: remaining });

        if (remaining > 0) return;

        // Phase complete
        const { mode, settings, completedWorkSessions, cycleCount, linkedTodoId } = get();
        let nextMode: FocusMode = 'work';
        let nextCompleted = completedWorkSessions;
        let nextCycle = cycleCount;
        let nextSessionLog = get().sessionLog;

        if (mode === 'work') {
          nextCompleted = completedWorkSessions + 1;
          nextCycle = cycleCount + 1;
          nextMode = nextCycle >= settings.longBreakInterval ? 'longBreak' : 'shortBreak';
          if (nextMode === 'longBreak') nextCycle = 0;

          const todayKey = new Date().toISOString().slice(0, 10);
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 90);
          const cutoffKey = cutoff.toISOString().slice(0, 10);
          nextSessionLog = [...nextSessionLog.filter(e => e.date >= cutoffKey),
            { date: todayKey, minutes: settings.workMinutes }];
        }

        window.dispatchEvent(new CustomEvent('focus-session-complete', {
          detail: { finishedMode: mode, nextMode, linkedTodoId },
        }));

        const nextDuration = durationFor(nextMode, settings);
        set({
          mode: nextMode,
          remainingSeconds: nextDuration,
          endTimestamp: settings.autoStartNext ? Date.now() + nextDuration * 1000 : null,
          isRunning: settings.autoStartNext,
          completedWorkSessions: nextCompleted,
          cycleCount: nextCycle,
          sessionLog: nextSessionLog,
        });

        // 专注阶段结束且不自动开始下一段时，自动关闭专注锁屏
        if (!settings.autoStartNext) {
          const overlay = useOverlayStore.getState();
          if (overlay.focusLock) overlay.closeFocusLock();
        }
      },

      switchMode: (mode) => {
        const { settings } = get();
        set({ mode, isRunning: false, endTimestamp: null, remainingSeconds: durationFor(mode, settings) });
      },

      setLinkedTodo: (id) => set({ linkedTodoId: id }),
    }),
    {
      name: 'todoapp-focus',
      version: 2,
      partialize: (state) => ({
        settings: state.settings,
        mode: state.mode,
        remainingSeconds: state.remainingSeconds,
        completedWorkSessions: state.completedWorkSessions,
        cycleCount: state.cycleCount,
        sessionLog: state.sessionLog,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as object),
        isRunning: false,
        endTimestamp: null,
      }),
    }
  )
);

export { DEFAULT_SETTINGS as FOCUS_DEFAULT_SETTINGS, durationFor as focusDurationFor };
