import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';
export type AccentColor = 'coral' | 'olive' | 'sky' | 'fig';
export type Language = 'zh' | 'en';
/** 列表排序模式：smart=优先级+截止时间自动排序；manual=用户拖拽手动排序 */
export type SortMode = 'smart' | 'manual';

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
  aboutOpen: boolean; // standalone about page modal state
  /** 每日成就弹窗触发时间，格式 "HH:MM"（24h），空字符串表示关闭 */
  achievementTime: string;
  /** 今天已展示成就弹窗的日期，避免重复弹出 */
  achievementLastDate: string;
  weeklyReportEnabled: boolean;
  weeklyReportDay: number;   // 0=Sun…6=Sat, default 1=Mon
  weeklyReportTime: string;  // 'HH:MM'
  weeklyReportLastDate: string;
  sortMode: SortMode;
  startupReminder: boolean;
  /** Cloud backup config */
  cloudBackupUrl: string;
  cloudBackupUser: string;
  cloudBackupPass: string;
  lastBackupAt: string;

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
  setAboutOpen: (open: boolean) => void;
  setAchievementTime: (time: string) => void;
  setAchievementLastDate: (date: string) => void;
  setWeeklyReportEnabled: (v: boolean) => void;
  setWeeklyReportDay: (day: number) => void;
  setWeeklyReportTime: (time: string) => void;
  setWeeklyReportLastDate: (date: string) => void;
  setSortMode: (mode: SortMode) => void;
  setStartupReminder: (v: boolean) => void;
  setCloudBackupUrl: (v: string) => void;
  setCloudBackupUser: (v: string) => void;
  setCloudBackupPass: (v: string) => void;
  setLastBackupAt: (v: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'zh',
      startupDelay: 5,
      hotkey: 'Alt+Shift+A',
      downloadPath: '',
      lastPromptDate: '',
      accentColor: 'coral' as AccentColor,
      reminderIgnored: false,
      isOpen: false,
      aboutOpen: false,
      achievementTime: '21:00',
      achievementLastDate: '',
      weeklyReportEnabled: true,
      weeklyReportDay: 1,
      weeklyReportTime: '09:00',
      weeklyReportLastDate: '',
      sortMode: 'smart' as SortMode,
      startupReminder: true,
      cloudBackupUrl: '',
      cloudBackupUser: '',
      cloudBackupPass: '',
      lastBackupAt: '',

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
      setAboutOpen: (aboutOpen) => set({ aboutOpen }),
      setAchievementTime: (achievementTime) => set({ achievementTime }),
      setAchievementLastDate: (achievementLastDate) => set({ achievementLastDate }),
      setWeeklyReportEnabled: (weeklyReportEnabled) => set({ weeklyReportEnabled }),
      setWeeklyReportDay: (weeklyReportDay) => set({ weeklyReportDay }),
      setWeeklyReportTime: (weeklyReportTime) => set({ weeklyReportTime }),
      setWeeklyReportLastDate: (weeklyReportLastDate) => set({ weeklyReportLastDate }),
      setSortMode: (sortMode) => set({ sortMode }),
      setStartupReminder: (startupReminder) => set({ startupReminder }),
      setCloudBackupUrl: (cloudBackupUrl) => set({ cloudBackupUrl }),
      setCloudBackupUser: (cloudBackupUser) => set({ cloudBackupUser }),
      setCloudBackupPass: (cloudBackupPass) => set({ cloudBackupPass }),
      setLastBackupAt: (lastBackupAt) => set({ lastBackupAt }),
    }),
    {
      name: 'todoapp-settings',
      version: 5,
      // v1→v2：theme 新增 'system' 模式（跟随系统日夜）；旧值 light/dark 保持有效
      // v2→v3：新增 sortMode（smart/manual），旧数据补默认值
      // v3→v4：新增 cloudBackupUrl/User/Pass/lastBackupAt
      // v4→v5：默认快捷键改为 Alt+Shift+A（避免与常见应用冲突）
      migrate: (persisted) => {
        const state = persisted as SettingsState;
        const oldHotkey = state.hotkey;
        if (oldHotkey === 'CmdOrCtrl+Shift+T' || oldHotkey === 'Ctrl+Shift+T') {
          state.hotkey = 'Alt+Shift+A';
        }
        return { ...state, sortMode: state.sortMode ?? 'smart' };
      },
    }
  )
);
