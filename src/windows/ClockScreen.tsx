import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOverlayStore } from '../store/overlayStore';

/**
 * ClockScreen — 时间流动屏保
 *
 * 设计参考：市面全屏时钟学习屏保（FsClock / Windows Alarms & Clock / Forest）
 *  - 200px 超大数字，fontWeight 300，极致立体感
 *  - 每位独立翻牌动效（framer-motion popLayout）
 *  - 全屏 + alwaysOnTop 覆盖系统任务栏
 *  - 鼠标悬停右上角 badge 变亮，滚轮 / 点击切换 12h/24h
 *  - 双击 / ESC 退出
 */

function getParts(use24h: boolean) {
  const now = new Date();
  const rawH = now.getHours();
  const h = use24h
    ? String(rawH).padStart(2, '0')
    : String(rawH % 12 || 12).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return { h, m, s, ampm: use24h ? '' : rawH < 12 ? 'AM' : 'PM' };
}

function getDateStr() {
  const now = new Date();
  const DAYS = ['日', '一', '二', '三', '四', '五', '六'];
  return `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}  周${DAYS[now.getDay()]}`;
}

async function setWindowFullscreen(full: boolean) {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    await win.setFullscreen(full);
    await win.setAlwaysOnTop(full);
  } catch { /* dev */ }
}

// 多层文字阴影 — 营造立体纵深感
const SHADOW = [
  '0 1px 0 rgba(255,255,255,0.04)',
  '0 2px 3px rgba(0,0,0,0.75)',
  '0 6px 16px rgba(0,0,0,0.65)',
  '0 14px 40px rgba(0,0,0,0.45)',
  '0 0 80px rgba(217,119,87,0.06)',
].join(', ');

const SZ = 200; // font-size px

function Digit({ val }: { val: string }) {
  return (
    <div style={{
      position: 'relative',
      width: SZ * 0.58,
      height: SZ * 1.08,
      overflow: 'hidden',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={val}
          initial={{ y: '-65%', opacity: 0, filter: 'blur(6px)' }}
          animate={{ y: '0%',  opacity: 1, filter: 'blur(0px)' }}
          exit={{   y:  '65%', opacity: 0, filter: 'blur(6px)' }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'absolute',
            fontFamily: "'Inter Variable', Inter, monospace",
            fontSize: SZ,
            fontWeight: 300,
            color: '#F7F3EE',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            textShadow: SHADOW,
          }}
        >
          {val}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function Colon() {
  return (
    <span style={{
      fontFamily: "'Inter Variable', Inter, monospace",
      fontSize: SZ * 0.65,
      fontWeight: 100,
      color: 'rgba(255,255,255,0.14)',
      lineHeight: 1,
      margin: `0 ${SZ * 0.02}px`,
      userSelect: 'none',
      textShadow: '0 4px 12px rgba(0,0,0,0.8)',
      alignSelf: 'center',
      paddingBottom: SZ * 0.04,
    }}>:</span>
  );
}

export default function ClockScreen() {
  const { closeClock } = useOverlayStore();
  const [use24h, setUse24h] = useState(true);
  const [parts, setParts] = useState(() => getParts(true));
  const [dateStr, setDateStr] = useState(getDateStr);
  const [hintVisible, setHintVisible] = useState(true);
  const [badgeHover, setBadgeHover] = useState(false);

  // Fullscreen
  useEffect(() => {
    setWindowFullscreen(true);
    return () => { setWindowFullscreen(false); };
  }, []);

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => {
      setParts(getParts(use24h));
      setDateStr(getDateStr());
    }, 300);
    return () => clearInterval(id);
  }, [use24h]);

  // Hide hint after 5s
  useEffect(() => {
    const t = setTimeout(() => setHintVisible(false), 5000);
    return () => clearTimeout(t);
  }, []);

  const toggle = useCallback(() => setUse24h(v => !v), []);

  // ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeClock(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeClock]);

  // Scroll wheel on whole screen → toggle 12h/24h
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      toggle();
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [toggle]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      onDoubleClick={closeClock}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        userSelect: 'none', cursor: 'none',
        overflow: 'hidden',
      }}
    >
      {/* 12h/24h badge — hover reveals cursor, click toggles */}
      <div
        onMouseEnter={() => setBadgeHover(true)}
        onMouseLeave={() => setBadgeHover(false)}
        onDoubleClick={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        style={{
          position: 'absolute', top: 32, right: 40,
          fontFamily: "'Inter Variable', Inter, sans-serif",
          fontSize: 12, letterSpacing: '0.14em',
          color: badgeHover ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.18)',
          cursor: 'pointer',
          padding: '5px 10px',
          borderRadius: 6,
          border: `1px solid ${badgeHover ? 'rgba(255,255,255,0.15)' : 'transparent'}`,
          transition: 'color 0.2s, border-color 0.2s',
          userSelect: 'none',
        }}
      >
        {use24h ? '24H' : '12H'}
      </div>

      {/* Scroll hint beside badge */}
      {badgeHover && (
        <div style={{
          position: 'absolute', top: 38, right: 116,
          fontFamily: "'Inter Variable', Inter, sans-serif",
          fontSize: 10, color: 'rgba(255,255,255,0.3)',
          letterSpacing: '0.08em', whiteSpace: 'nowrap',
        }}>
          滚轮 / 点击切换
        </div>
      )}

      {/* Clock digits */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Digit val={parts.h[0]} />
        <Digit val={parts.h[1]} />
        <Colon />
        <Digit val={parts.m[0]} />
        <Digit val={parts.m[1]} />
        <Colon />
        <Digit val={parts.s[0]} />
        <Digit val={parts.s[1]} />

        {parts.ampm && (
          <motion.span
            key={parts.ampm}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              fontFamily: "'Inter Variable', Inter, sans-serif",
              fontSize: 26, fontWeight: 300,
              color: 'rgba(255,255,255,0.28)',
              marginLeft: 24,
              alignSelf: 'flex-end',
              paddingBottom: SZ * 0.13,
              letterSpacing: '0.08em',
              textShadow: '0 2px 10px rgba(0,0,0,0.9)',
            }}
          >
            {parts.ampm}
          </motion.span>
        )}
      </div>

      {/* Date */}
      <div style={{
        marginTop: 20,
        fontFamily: "'Inter Variable', Inter, sans-serif",
        fontSize: 16, fontWeight: 300,
        color: 'rgba(255,255,255,0.14)',
        letterSpacing: '0.26em',
      }}>
        {dateStr}
      </div>

      {/* Hint */}
      <AnimatePresence>
        {hintVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            style={{
              position: 'absolute', bottom: 32,
              left: '50%', transform: 'translateX(-50%)',
              fontFamily: "'Inter Variable', Inter, sans-serif",
              fontSize: 11, color: 'rgba(255,255,255,0.15)',
              letterSpacing: '0.1em', whiteSpace: 'nowrap',
            }}
          >
            双击退出 · 滚轮或点击右上角切换时制 · ESC 退出
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
