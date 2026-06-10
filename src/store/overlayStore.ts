import { create } from 'zustand';

/**
 * overlayStore — 全屏 overlay 开关
 * focusLock : 专注锁屏 overlay
 * clock     : 时间流动屏保 overlay
 */
interface OverlayState {
  focusLock: boolean;
  clock: boolean;
  openFocusLock: () => void;
  closeFocusLock: () => void;
  openClock: () => void;
  closeClock: () => void;
}

export const useOverlayStore = create<OverlayState>((set) => ({
  focusLock: false,
  clock: false,
  openFocusLock: () => set({ focusLock: true }),
  closeFocusLock: () => set({ focusLock: false }),
  openClock: () => set({ clock: true }),
  closeClock: () => set({ clock: false }),
}));
