/**
 * soundscape.ts — Asha 音景播放引擎
 *
 * HTMLAudioElement 单例池：模块级持有，不随组件卸载销毁，
 * 因此工具面板关闭后白噪音继续播放（与 timerStore 的后台运行哲学一致）。
 *
 * 音频文件位于 public/sounds/<id>.mp3。文件缺失时触发 onMissing 回调，
 * UI 据此显示「未安装」状态而不是静默失败。
 *
 * 沙盒原则：内置音景清单 SOUND_LIBRARY 为系统固定配置，
 * 后续 AI / 用户音乐库功能不得修改本清单。
 */

export type SoundCategory = 'nature' | 'ambience' | 'noise';

export interface SoundDef {
  id: string;
  /** public/sounds/ 下的文件名 */
  file: string;
  labelZh: string;
  labelEn: string;
  category: SoundCategory;
  /** 推荐来源（Pixabay Content License / CC0），供 LICENSES.md 与下载脚本使用 */
  sourceHint: string;
}

// 8 个内置音景：自然 4 + 环境 2 + 噪音 2
export const SOUND_LIBRARY: SoundDef[] = [
  { id: 'rain',    file: 'rain.mp3',    labelZh: '雨声',   labelEn: 'Rain',       category: 'nature',   sourceHint: 'Pixabay (universfield): "soft rain atmosphere"' },
  { id: 'thunder', file: 'thunder.mp3', labelZh: '雷雨',   labelEn: 'Thunder',    category: 'nature',   sourceHint: 'Pixabay (freesound_community): "thunder"' },
  { id: 'ocean',   file: 'ocean.mp3',   labelZh: '海浪',   labelEn: 'Ocean',      category: 'nature',   sourceHint: 'Pixabay (dragon-studio): "gentle ocean waves"' },
  { id: 'forest',  file: 'forest.mp3',  labelZh: '森林鸟鸣', labelEn: 'Forest',   category: 'nature',   sourceHint: 'Pixabay (audiopapkin): "forest ambience"' },
  { id: 'cafe',    file: 'cafe.mp3',    labelZh: '咖啡馆', labelEn: 'Café',       category: 'ambience', sourceHint: 'Pixabay (freesound_community): "cafe noise"' },
  { id: 'fire',    file: 'fire.mp3',    labelZh: '篝火',   labelEn: 'Fireplace',  category: 'ambience', sourceHint: 'Pixabay (king_of_the_christmas): "fireplace loop"' },
  { id: 'stream',  file: 'stream.mp3',  labelZh: '溪流',   labelEn: 'Stream',     category: 'nature',   sourceHint: 'Pixabay (u_g4b6tnje0y): "water stream"' },
  { id: 'white',   file: 'white.mp3',   labelZh: '白噪音', labelEn: 'White Noise', category: 'noise',   sourceHint: 'Pixabay (themediaguy): "soft white noise"' },
];

// ── 播放引擎（模块级单例池）────────────────────────────────────────────

const pool = new Map<string, HTMLAudioElement>();
let masterVolume = 0.7;
const missing = new Set<string>();
type Listener = () => void;
const listeners = new Set<Listener>();

function notify() { listeners.forEach((fn) => fn()); }

/** UI 订阅引擎状态变化（播放/缺失文件） */
export function subscribeSoundscape(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function getAudio(id: string): HTMLAudioElement | null {
  const def = SOUND_LIBRARY.find((s) => s.id === id);
  if (!def) return null;
  let audio = pool.get(id);
  if (!audio) {
    audio = new Audio(`/sounds/${def.file}`);
    audio.loop = true;
    audio.preload = 'none';
    audio.onerror = () => {
      missing.add(id);
      pool.delete(id);
      notify();
    };
    pool.set(id, audio);
  }
  return audio;
}

export function playSound(id: string, volume: number): void {
  const audio = getAudio(id);
  if (!audio) return;
  audio.volume = clamp01(volume * masterVolume);
  audio.play().catch(() => {
    missing.add(id);
    notify();
  });
  notify();
}

export function stopSound(id: string): void {
  const audio = pool.get(id);
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  notify();
}

export function stopAll(): void {
  pool.forEach((audio) => { audio.pause(); audio.currentTime = 0; });
  notify();
}

export function setSoundVolume(id: string, volume: number): void {
  const audio = pool.get(id);
  if (audio) audio.volume = clamp01(volume * masterVolume);
}

export function setMasterVolume(v: number, trackVolumes: Record<string, number>): void {
  masterVolume = clamp01(v);
  pool.forEach((audio, id) => {
    audio.volume = clamp01((trackVolumes[id] ?? 0.7) * masterVolume);
  });
}

export function isPlaying(id: string): boolean {
  const audio = pool.get(id);
  return !!audio && !audio.paused;
}

export function anyPlaying(): boolean {
  for (const audio of pool.values()) if (!audio.paused) return true;
  return false;
}

export function isMissing(id: string): boolean {
  return missing.has(id);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
