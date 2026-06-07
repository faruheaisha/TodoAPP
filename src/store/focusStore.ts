import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * focusStore — 番茄钟 / 专注计时状态
 *
 * 设计说明：本 store 仅服务于「工具面板」体系下的第一个工具（番茄钟）。
 * 后续工具（如日历、习惯打卡）应各自拥有独立 store，并通过
 * ToolsPanel 的注册表机制接入界面，不应耦合进本文件。
 */

export type FocusMode = 'work' | 'shortBreak' | 'longBreak';

export interface FocusSettings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number; // 每完成 N 个专注段后进入长休息
  autoStartNext: boolean; // 是否自动开始下一段
  soundEnabled: boolean; // 完成时是否提示音/系统通知
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
    case 'work':
      return settings.workMinutes * 60;
    case 'shortBreak':
      return settings.shortBreakMinutes * 60;
    case 'longBreak':
      return settings.longBreakMinutes * 60;
  }
}

interface FocusState {
  settings: FocusSettings;

  mode: FocusMode;
  remainingSeconds: number;
  isRunning: boolean;

  completedWorkSessions: number; // 历史累计完成的专注段（持久化，用于统计/未来打通习惯打卡）
  cycleCount: number; // 自上次长休息以来已完成的专注段数
  linkedTodoId: string | null; // 可选：将本次专注会话与某个待办关联

  updateSettings: (updates: Partial<FocusSettings>) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  tick: () => void;
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

      completedWorkSessions: 0,
      cycleCount: 0,
      linkedTodoId: null,

      updateSettings: (updates) => {
        const settings = { ...get().settings, ...updates };
        set((state) => ({
          settings,
          // 仅在未运行时才同步刷新当前模式的剩余时长，避免打断进行中的计时
          remainingSeconds: state.isRunning ? state.remainingSeconds : durationFor(state.mode, settings),
        }));
      },

      start: () => set({ isRunning: true }),
      pause: () => set({ isRunning: false }),

      reset: () => {
        const { mode, settings } = get();
        set({ isRunning: false, remainingSeconds: durationFor(mode, settings) });
      },

      tick: () => {
        const { remainingSeconds, isRunning } = get();
        if (!isRunning) return;

        if (remainingSeconds <= 1) {
          // 当前阶段完成 — 计算下一阶段
          const { mode, settings, completedWorkSessions, cycleCount, linkedTodoId } = get();
          let nextMode: FocusMode = 'work';
          let nextCompleted = completedWorkSessions;
          let nextCycle = cycleCount;

          if (mode === 'work') {
            nextCompleted = completedWorkSessions + 1;
            nextCycle = cycleCount + 1;
            nextMode = nextCycle >= settings.longBreakInterval ? 'longBreak' : 'shortBreak';
            if (nextMode === 'longBreak') nextCycle = 0;
          } else {
            nextMode = 'work';
          }

          window.dispatchEvent(
            new CustomEvent('focus-session-complete', {
              detail: { finishedMode: mode, nextMode, linkedTodoId },
            })
          );

          set({
            mode: nextMode,
            remainingSeconds: durationFor(nextMode, settings),
            isRunning: settings.autoStartNext,
            completedWorkSessions: nextCompleted,
            cycleCount: nextCycle,
          });
        } else {
          set({ remainingSeconds: remainingSeconds - 1 });
        }
      },

      switchMode: (mode) => {
        const { settings } = get();
        set({ mode, isRunning: false, remainingSeconds: durationFor(mode, settings) });
      },

      setLinkedTodo: (id) => set({ linkedTodoId: id }),
    }),
    {
      name: 'todoapp-focus',
      version: 1,
      // 运行态（isRunning/remainingSeconds）不必跨会话持久化为"运行中"，
      // 但保留剩余时间便于用户误关时找回进度；isRunning 重启后归位为暂停。
      partialize: (state) => ({
        settings: state.settings,
        mode: state.mode,
        remainingSeconds: state.remainingSeconds,
        completedWorkSessions: state.completedWorkSessions,
        cycleCount: state.cycleCount,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as object),
        isRunning: false,
      }),
    }
  )
);

export { DEFAULT_SETTINGS as FOCUS_DEFAULT_SETTINGS, durationFor as focusDurationFor };
