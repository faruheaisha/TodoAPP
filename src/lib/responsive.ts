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
import { useEffect, useState, type CSSProperties } from 'react';

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

/**
 * 居中模态 ↔ 移动端底部 sheet 的统一动效/样式切换。
 * 桌面：scale 渐入的居中卡片；手机：从底部滑入、贴边全宽、顶部圆角的 sheet。
 * 各模态把返回值铺到「定位层 className」「motion props」「容器 style」即可，
 * 形态决策集中一处，避免三个面板各写一份。
 */
export function useSheet() {
  const isPhone = useIsPhone();
  return {
    isPhone,
    /** 外层定位层：手机贴底，桌面居中 */
    alignClass: isPhone ? 'items-end' : 'items-center',
    /** Framer Motion 进出场 props */
    motion: isPhone
      ? {
          initial: { opacity: 0, y: '100%' },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: '100%' },
          transition: { type: 'spring' as const, damping: 32, stiffness: 340 },
        }
      : {
          initial: { opacity: 0, scale: 0.96 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.96 },
          transition: { type: 'spring' as const, damping: 28, stiffness: 300 },
        },
    /**
     * 容器尺寸/圆角/安全区样式。
     * @param desktop 桌面态的 width/height/maxWidth 等（如 { width: 'min(760px,92vw)', height: 'min(560px,88vh)' }）
     */
    panelStyle(desktop: CSSProperties): CSSProperties {
      if (!isPhone) return { ...desktop, borderRadius: 'var(--radius-lg)' };
      return {
        width: '100%',
        maxHeight: '92dvh',
        borderRadius: '20px 20px 0 0',
        paddingBottom: 'var(--safe-bottom)',
      };
    },
  };
}
