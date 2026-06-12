import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  playSound, stopSound, setSoundVolume, setMasterVolume as engineSetMaster,
} from '../lib/soundscape';

/**
 * soundscapeStore — 音景偏好与启停状态
 *
 * persist：各轨音量 + 主音量 + 上次启用的轨道集合（便于一键恢复场景）。
 * 运行态（正在播放）不持久化——重启应用不自动出声，避免惊吓。
 * 实际发声由 lib/soundscape.ts 的模块级引擎负责。
 */

interface SoundscapeState {
  /** trackId → 音量 0-1 */
  volumes: Record<string, number>;
  masterVolume: number;
  /** 当前会话启用的轨道（运行态，不持久化） */
  active: string[];

  toggleTrack: (id: string) => void;
  setVolume: (id: string, v: number) => void;
  setMaster: (v: number) => void;
  stopAllTracks: () => void;
}

const DEFAULT_TRACK_VOLUME = 0.7;

export const useSoundscapeStore = create<SoundscapeState>()(
  persist(
    (set, get) => ({
      volumes: {},
      masterVolume: 0.7,
      active: [],

      toggleTrack: (id) => {
        const { active, volumes } = get();
        if (active.includes(id)) {
          stopSound(id);
          set({ active: active.filter((t) => t !== id) });
        } else {
          playSound(id, volumes[id] ?? DEFAULT_TRACK_VOLUME);
          set({ active: [...active, id] });
        }
      },

      setVolume: (id, v) => {
        set((s) => ({ volumes: { ...s.volumes, [id]: v } }));
        setSoundVolume(id, v);
      },

      setMaster: (v) => {
        set({ masterVolume: v });
        engineSetMaster(v, get().volumes);
      },

      stopAllTracks: () => {
        get().active.forEach((id) => stopSound(id));
        set({ active: [] });
      },
    }),
    {
      name: 'todoapp-soundscape',
      version: 1,
      partialize: (s) => ({ volumes: s.volumes, masterVolume: s.masterVolume }),
      // 恢复持久化音量后同步到播放引擎
      onRehydrateStorage: () => (state) => {
        if (state) engineSetMaster(state.masterVolume, state.volumes);
      },
    }
  )
);
