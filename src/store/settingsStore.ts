import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';
export type Language = 'zh' | 'en';

interface SettingsState {
  theme: Theme;
  language: Language;
  startupDelay: number; // in minutes
  hotkey: string;
  downloadPath: string;
  lastPromptDate: string;
  reminderIgnored: boolean;
  isOpen: boolean; // settings drawer open state

  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  setStartupDelay: (delay: number) => void;
  setHotkey: (hotkey: string) => void;
  setDownloadPath: (path: string) => void;
  setLastPromptDate: (date: string) => void;
  setReminderIgnored: (ignored: boolean) => void;
  resetReminderIgnored: () => void;
  setIsOpen: (open: boolean) => void;
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
      reminderIgnored: false,
      isOpen: false,

      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setStartupDelay: (startupDelay) => set({ startupDelay }),
      setHotkey: (hotkey) => set({ hotkey }),
      setDownloadPath: (downloadPath) => set({ downloadPath }),
      setLastPromptDate: (lastPromptDate) => set({ lastPromptDate }),
      setReminderIgnored: (reminderIgnored) => set({ reminderIgnored }),
      resetReminderIgnored: () => set({ reminderIgnored: false }),
      setIsOpen: (isOpen) => set({ isOpen }),
    }),
    {
      name: 'todoapp-settings',
      version: 1,
    }
  )
);
