import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';
export type AccentColor = 'coral' | 'olive' | 'sky' | 'fig';
export type Language = 'zh' | 'en';

interface SettingsState {
  theme: Theme;
  language: Language;
  startupDelay: number; // in minutes
  hotkey: string;
  downloadPath: string;
  lastPromptDate: string;
  accentColor: AccentColor;
  reminderIgnored: boolean;
  isOpen: boolean; // settings drawer open state
  /** 每日成就弹窗触发时间，格式 "HH:MM"（24h），空字符串表示关闭 */
  achievementTime: string;
  /** 今天已展示成就弹窗的日期，避免重复弹出 */
  achievementLastDate: string;
  weeklyReportEnabled: boolean;
  weeklyReportDay: number;   // 0=Sun…6=Sat, default 1=Mon
  weeklyReportTime: string;  // 'HH:MM'
  weeklyReportLastDate: string;

  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  setStartupDelay: (delay: number) => void;
  setHotkey: (hotkey: string) => void;
  setDownloadPath: (path: string) => void;
  setLastPromptDate: (date: string) => void;
  setAccentColor: (accent: AccentColor) => void;
  setReminderIgnored: (ignored: boolean) => void;
  resetReminderIgnored: () => void;
  setIsOpen: (open: boolean) => void;
  setAchievementTime: (time: string) => void;
  setAchievementLastDate: (date: string) => void;
  setWeeklyReportEnabled: (v: boolean) => void;
  setWeeklyReportDay: (day: number) => void;
  setWeeklyReportTime: (time: string) => void;
  setWeeklyReportLastDate: (date: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      language: 'zh',
      startupDelay: 5,
      hotkey: 'CmdOrCtrl+Shift+T',
      downloadPath: '',
      lastPromptDate: '',
      accentColor: 'coral' as AccentColor,
      reminderIgnored: false,
      isOpen: false,
      achievementTime: '21:00',
      achievementLastDate: '',
      weeklyReportEnabled: true,
      weeklyReportDay: 1,
      weeklyReportTime: '09:00',
      weeklyReportLastDate: '',

      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setStartupDelay: (startupDelay) => set({ startupDelay }),
      setHotkey: (hotkey) => set({ hotkey }),
      setDownloadPath: (downloadPath) => set({ downloadPath }),
      setLastPromptDate: (lastPromptDate) => set({ lastPromptDate }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setReminderIgnored: (reminderIgnored) => set({ reminderIgnored }),
      resetReminderIgnored: () => set({ reminderIgnored: false }),
      setIsOpen: (isOpen) => set({ isOpen }),
      setAchievementTime: (achievementTime) => set({ achievementTime }),
      setAchievementLastDate: (achievementLastDate) => set({ achievementLastDate }),
      setWeeklyReportEnabled: (weeklyReportEnabled) => set({ weeklyReportEnabled }),
      setWeeklyReportDay: (weeklyReportDay) => set({ weeklyReportDay }),
      setWeeklyReportTime: (weeklyReportTime) => set({ weeklyReportTime }),
      setWeeklyReportLastDate: (weeklyReportLastDate) => set({ weeklyReportLastDate }),
    }),
    {
      name: 'todoapp-settings',
      version: 1,
    }
  )
);
