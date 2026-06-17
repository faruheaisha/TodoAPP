/**
 * musicLibrary.ts — 个人音乐库播放引擎
 *
 * 用户导入的音频文件存储于 Tauri AppLocalData/music_library/ 目录，
 * 前端通过 convertFileSrc 转换为 asset:// URL 后直接 HTMLAudioElement 播放，
 * 无需将整个文件读入内存。
 * 与 soundscape.ts 的引擎平行但独立运作。
 */
import { convertFileSrc } from '@tauri-apps/api/core';

// ── 模块级音频池 ─────────────────────────────────────────────
interface PoolEntry {
  audio: HTMLAudioElement;
  /** convertFileSrc URL，用于清理 */
  assetUrl: string;
}

const pool = new Map<string, PoolEntry>();
let masterVolume = 0.7;

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() { listeners.forEach((fn) => fn()); }

export function subscribeMusicLibrary(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export async function playUserTrack(id: string, filePath: string, volume: number): Promise<void> {
  // 关闭已有实例
  const existing = pool.get(id);
  if (existing) {
    existing.audio.pause();
    existing.audio.currentTime = 0;
  }

  const assetUrl = convertFileSrc(filePath);
  const audio = new Audio(assetUrl);
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = clamp01(volume * masterVolume);

  pool.set(id, { audio, assetUrl });

  try {
    await audio.play();
  } catch {
    // 自动静默
  }
  notify();
}

export function stopUserTrack(id: string): void {
  const entry = pool.get(id);
  if (entry) {
    entry.audio.pause();
    entry.audio.currentTime = 0;
  }
  notify();
}

export function stopAllUserTracks(): void {
  pool.forEach((entry) => {
    entry.audio.pause();
    entry.audio.currentTime = 0;
  });
  notify();
}

export function setUserTrackVolume(id: string, volume: number): void {
  const entry = pool.get(id);
  if (entry) {
    entry.audio.volume = clamp01(volume * masterVolume);
  }
}

export function setMusicLibraryMasterVolume(v: number, trackVolumes: Record<string, number>): void {
  masterVolume = clamp01(v);
  pool.forEach((entry, id) => {
    entry.audio.volume = clamp01((trackVolumes[id] ?? 0.7) * masterVolume);
  });
}

export function isUserTrackPlaying(id: string): boolean {
  const entry = pool.get(id);
  return !!entry && !entry.audio.paused;
}

export function anyUserTrackPlaying(): boolean {
  for (const entry of pool.values()) if (!entry.audio.paused) return true;
  return false;
}

/** 销毁并释放所有资源（app 关闭时） */
export function destroyPool(): void {
  pool.forEach((entry) => {
    entry.audio.pause();
    entry.audio.src = '';
  });
  pool.clear();
}

export function getUserTrackPoolSize(): number {
  return pool.size;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
