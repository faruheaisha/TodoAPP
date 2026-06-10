import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../i18n/index';

/**
 * ClockScreen — 时间流动屏保
 *
 * 设计灵感：FsClock-Android / 市场上的全屏时钟学习屏保
 * 全黑背景，巨大数字时钟，平滑翻牌动效，日期副标题。
 * T 键切换 12h/24h，ESC 关闭。
 *
 * 翻牌动效参考：Split-flap / Flip clock pattern（使用 Framer Motion AnimatePresence Y轴翻转）
 */

function getTimeParts(use24h: boolean) {
  const now = new Date();
  const h = use24h
    ? String(now.getHours()).padStart(2, '0')
    : String(now.getHours() % 12 || 12).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const ampm = !use24h ? (now.getHours() < 12 ? 'AM' : 'PM') : '';
  return { h, m, s, ampm };
}

function getDateStr() {
  const now = new Date();
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  const d = days[now.getDay()];
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${y}.${mo}.${dd}  周${d}`;
}

/** Single animated digit — flips when value changes (vertical slide) */
function Digit({ val, size = 140 }: { val: string; size?: number }) {
  return (
    <div style={{ position: 'relative', width: size * 0.62, height: size, overflow: 'hidden', display: 'inline-block' }}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={val}
          initial={{ y: '-60%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '60%', opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Inter Variable', Inter, monospace",
            fontSize: size,
            fontWeight: 200,
            color: '#ffffff',
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}
        >
          {val}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function Colon({ size = 140 }: { size?: number }) {
  return (
    <span
      style={{
        fontFamily: "'Inter Variable', Inter, monospace",
        fontSize: size,
        fontWeight: 200,
        color: 'rgba(255,255,255,0.3)',
        lineHeight: 1,
        letterSpacing: 0,
        margin: `0 ${size * 0.04}px`,
        userSelect: 'none',
      }}
    >
      :
    </span>
  );
}

export default function ClockScreen() {
  const [use24h, setUse24h] = useState(true);
  const [parts, setParts] = useState(() => getTimeParts(true));
  const [dateStr, setDateStr] = useState(getDateStr);
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setParts(getTimeParts(use24h));
      setDateStr(getDateStr());
    }, 500);
    return () => clearInterval(id);
  }, [use24h]);

  // Hide hint after 4 seconds
  useEffect(() => {
    const t = setTimeout(() => setHintVisible(false), 4000);
    return () => clearTimeout(t);
  }, []);

  const toggle24h = useCallback(() => {
    setUse24h(v => {
      const next = !v;
      setParts(getTimeParts(next));
      return next;
    });
  }, []);

  useEffect(() => {
    async function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        getCurrentWindow().close();
      }
      if (e.key === 't' || e.key === 'T') {
        toggle24h();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggle24h]);

  const DIGIT_SIZE = 140;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        overflow: 'hidden',
        cursor: 'none',
      }}
      onDoubleClick={toggle24h}
    >
      {/* Main clock display */}
      <div style={{ display: 'flex', alignItems: 'center', lineHeight: 1 }}>
        <Digit val={parts.h[0]} size={DIGIT_SIZE} />
        <Digit val={parts.h[1]} size={DIGIT_SIZE} />
        <Colon size={DIGIT_SIZE} />
        <Digit val={parts.m[0]} size={DIGIT_SIZE} />
        <Digit val={parts.m[1]} size={DIGIT_SIZE} />
        <Colon size={DIGIT_SIZE} />
        <Digit val={parts.s[0]} size={DIGIT_SIZE} />
        <Digit val={parts.s[1]} size={DIGIT_SIZE} />

        {/* AM/PM badge */}
        {parts.ampm && (
          <AnimatePresence>
            <motion.span
              key={parts.ampm}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                fontFamily: "'Inter Variable', Inter, sans-serif",
                fontSize: '24px',
                fontWeight: 300,
                color: 'rgba(255,255,255,0.45)',
                marginLeft: 16,
                alignSelf: 'flex-end',
                paddingBottom: DIGIT_SIZE * 0.14,
                letterSpacing: '0.08em',
              }}
            >
              {parts.ampm}
            </motion.span>
          </AnimatePresence>
        )}
      </div>

      {/* Date */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{
          marginTop: 24,
          fontFamily: "'Inter Variable', Inter, sans-serif",
          fontSize: '18px',
          fontWeight: 300,
          color: 'rgba(255,255,255,0.22)',
          letterSpacing: '0.18em',
        }}
      >
        {dateStr}
      </motion.div>

      {/* Hint overlay — fades out */}
      <AnimatePresence>
        {hintVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            style={{
              position: 'absolute',
              bottom: 32,
              left: '50%',
              transform: 'translateX(-50%)',
              fontFamily: "'Inter Variable', Inter, sans-serif",
              fontSize: '11px',
              color: 'rgba(255,255,255,0.2)',
              letterSpacing: '0.12em',
              textAlign: 'center',
              lineHeight: 1.8,
            }}
          >
            T 键切换 12h/24h · 双击切换 · ESC 退出
          </motion.div>
        )}
      </AnimatePresence>

      {/* 24h badge top-right */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          right: 32,
          fontFamily: "'Inter Variable', Inter, sans-serif",
          fontSize: '11px',
          color: 'rgba(255,255,255,0.15)',
          letterSpacing: '0.1em',
        }}
      >
        {use24h ? '24H' : '12H'}
      </div>
    </div>
  );
}
