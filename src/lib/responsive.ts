/**
 * responsive.ts — 跨端自适应基础设施
 *
 * 一套响应式 UI 适配 桌面(Tauri) + 移动(PWA) 全尺寸。
 * 所有布局/主题的「端差异」决策都从这里取值，组件内不直接写 matchMedia，
 * 保证断点口径全局统一、易于调整。
 *
 * 断点口径（与 globals.css 的 @media 保持一致）：
 *   phone   : <= 600px            手机（竖屏为主）
 *   tablet  : 601px – 1024px      平板 / 小窗
 *   desktop : > 1024px            桌面
 */
import { useEffect, useState } from 'react';

/** 通用媒体查询订阅 hook —— SSR/非浏览器环境安全降级为 false */
export function useMediaQuery(query: string): boolean {
  const getMatch = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false;

  const [matches, setMatches] = useState(getMatch);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const handler = () => setMatches(mql.matches);
    handler(); // 立即同步一次，避免首帧错位
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// ── 断点 ──────────────────────────────────────────────────────────────────
export const BREAKPOINTS = { phone: 600, tablet: 1024 } as const;

/** 手机尺寸（竖屏宽度 <= 600px） */
export const useIsPhone = () => useMediaQuery(`(max-width: ${BREAKPOINTS.phone}px)`);
/** 平板及以下（<= 1024px） */
export const useIsCompact = () => useMediaQuery(`(max-width: ${BREAKPOINTS.tablet}px)`);
/** 竖屏 */
export const useIsPortrait = () => useMediaQuery('(orientation: portrait)');
/** 触控设备（手指为主输入，无精确指针）→ 决定是否放大点击目标、常驻操作按钮 */
export const useIsTouch = () => useMediaQuery('(pointer: coarse)');
/** 系统当前是否为深色（用于 theme='system' 跟随手机/系统日夜模式） */
export const usePrefersDark = () => useMediaQuery('(prefers-color-scheme: dark)');
