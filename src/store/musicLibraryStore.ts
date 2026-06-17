/**
 * musicLibraryStore.ts — 个人音乐库状态管理
 *
 * 持久化字段：用户导入的曲目列表 + 分类标签 + 音量偏好
 * 运行态（正在播放）不持久化，避免重启后自动出声。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  playUserTrack, stopUserTrack, setUserTrackVolume,
  setMusicLibraryMasterVolume,
} from '../lib/musicLibrary';

export interface UserTrack {
  /** 唯一 ID（UUID） */
  id: string;
  /** 原始文件名（不含路径，仅显示用） */
  name: string;
  /** 磁盘上的绝对路径 */
  filePath: string;
  /** 用户自定义标签 */
  tags: string[];
  /** 导入时间戳 */
  importedAt: number;
}

export interface MusicCategory {
  id: string;
  name: string;
}

interface MusicLibraryState {
  tracks: UserTrack[];
  categories: MusicCategory[];
  /** trackId → 音量 0-1 */
  volumes: Record<string, number>;
  masterVolume: number;
  /** 当前激活的播放轨道（运行态，不持久化） */
  active: string[];

  addTrack: (track: UserTrack) => void;
  removeTrack: (id: string) => void;
  updateTrackTags: (id: string, tags: string[]) => void;
  addCategory: (name: string) => void;
  removeCategory: (id: string) => void;
  renameCategory: (id: string, name: string) => void;
  togglePlay: (id: string, filePath: string) => void;
  setVolume: (id: string, v: number) => void;
  setMaster: (v: number) => void;
  stopAll: () => void;
}

const DEFAULT_VOLUME = 0.7;

export const useMusicLibraryStore = create<MusicLibraryState>()(
  persist(
    (set, get) => ({
      tracks: [],
      categories: [],
      volumes: {},
      masterVolume: 0.7,
      active: [],

      addTrack: (track) => {
        set((s) => ({ tracks: [...s.tracks, track] }));
      },

      removeTrack: (id) => {
        const { active } = get();
        if (active.includes(id)) {
          stopUserTrack(id);
        }
        set((s) => ({
          tracks: s.tracks.filter((t) => t.id !== id),
          active: s.active.filter((a) => a !== id),
        }));
      },

      updateTrackTags: (id, tags) => {
        set((s) => ({
          tracks: s.tracks.map((t) =>
            t.id === id ? { ...t, tags } : t
          ),
        }));
      },

      addCategory: (name) => {
        const id = 'cat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        set((s) => ({ categories: [...s.categories, { id, name }] }));
      },

      removeCategory: (id) => {
        // 移除分类标签时，将所有标有该分类的曲目去掉此标签
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          tracks: s.tracks.map((t) => ({
            ...t,
            tags: t.tags.filter((tag) => tag !== id),
          })),
        }));
      },

      renameCategory: (id, name) => {
        set((s) => ({
          categories: s.categories.map((c) =>
            c.id === id ? { ...c, name } : c
          ),
        }));
      },

      togglePlay: (id, filePath) => {
        const { active, volumes } = get();
        if (active.includes(id)) {
          stopUserTrack(id);
          set({ active: active.filter((a) => a !== id) });
        } else {
          playUserTrack(id, filePath, volumes[id] ?? DEFAULT_VOLUME);
          set({ active: [...active, id] });
        }
      },

      setVolume: (id, v) => {
        set((s) => ({ volumes: { ...s.volumes, [id]: v } }));
        setUserTrackVolume(id, v);
      },

      setMaster: (v) => {
        set({ masterVolume: v });
        setMusicLibraryMasterVolume(v, get().volumes);
      },

      stopAll: () => {
        get().active.forEach((id) => stopUserTrack(id));
        set({ active: [] });
      },
    }),
    {
      name: 'todoapp-music-library',
      version: 1,
      partialize: (s) => ({
        tracks: s.tracks,
        categories: s.categories,
        volumes: s.volumes,
        masterVolume: s.masterVolume,
      }),
    }
  )
);
