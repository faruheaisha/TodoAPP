import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOverlayStore } from '../store/overlayStore';

/**
 * ClockScreen — 时间流动屏保 overlay
 *
 * 设计参考：FsClock-Android + 市场全屏时钟学习屏保
 * 全屏黑色背景，巨幅数字时钟，每位独立翻牌动效。
 *
 * 翻牌动效：每秒变化的数字从上滑入（Y: -100% → 0），旧值向下滑出
 * 参考：split-flap clock UI pattern（Framer Motion AnimatePresence mode="popLayout"）
 *
 * 操作：T键/双击切换12h/24h，ESC关闭
 */

function getParts(use24h: boolean) {
  const now = new Date();
  const rawH = now.getHours();
  const h = use24h
    ? String(rawH).padStart(2, '0')
    : String(rawH % 12 || 12).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const ampm = use24h ? '' : rawH < 12 ? 'AM' : 'PM';
  return { h, m, s, ampm };
}

function getDateStr() {
  const now = new Date();
  const DAYS = ['日', '一', '二', '三', '四', '五', '六'];
  return `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}  周${DAYS[now.getDay()]}`;
}

/** Single flipping digit */
function Digit({ val, size }: { val: string; size: number }) {
  return (
    <div style={{
      position: 'relative',
      width: size * 0.58,
      height: size * 1.12,
      overflow: 'hidden',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={val}
          initial={{ y: '-55%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '55%', opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: 'absolute',
            fontFamily: "'Inter Variable', Inter, monospace",
            fontSize: size,
            fontWeight: 100,
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

function Sep({ size }: { size: number }) {
  return (
    <span style={{
      fontFamily: "'Inter Variable', Inter, monospace",
      fontSize: size,
      fontWeight: 100,
      color: 'rgba(255,255,255,0.18)',
      lineHeight: 1,
      margin: `0 ${size * 0.03}px`,
      userSelect: 'none',
    }}>:</span>
  );
}

export default function ClockScreen() {
  const { closeClock } = useOverlayStore();
  const [use24h, setUse24h] = useState(true);
  const [parts, setParts] = useState(() => getParts(true));
  const [dateStr, setDateStr] = useState(getDateStr);
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setParts(getParts(use24h));
      setDateStr(getDateStr());
    }, 300);
    return () => clearInterval(id);
  }, [use24h]);

  useEffect(() => {
    const t = setTimeout(() => setHintVisible(false), 5000);
    return () => clearTimeout(t);
  }, []);

  const toggle = useCallback(() => {
    setUse24h(v => !v);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeClock();
      if (e.key === 't' || e.key === 'T') toggle();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeClock, toggle]);

  const SZ = 130;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      onDoubleClick={toggle}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        cursor: 'none',
      }}
    >
      {/* 12/24H badge */}
      <div style={{
        position: 'absolute', top: 28, right: 36,
        fontFamily: "'Inter Variable', Inter, sans-serif",
        fontSize: 11, color: 'rgba(255,255,255,0.15)',
        letterSpacing: '0.12em',
      }}>
        {use24h ? '24H' : '12H'}
      </div>

      {/* Clock row */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Digit val={parts.h[0]} size={SZ} />
        <Digit val={parts.h[1]} size={SZ} />
        <Sep size={SZ} />
        <Digit val={parts.m[0]} size={SZ} />
        <Digit val={parts.m[1]} size={SZ} />
        <Sep size={SZ} />
        <Digit val={parts.s[0]} size={SZ} />
        <Digit val={parts.s[1]} size={SZ} />

        {parts.ampm && (
          <motion.span
            key={parts.ampm}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              fontFamily: "'Inter Variable', Inter, sans-serif",
              fontSize: 22,
              fontWeight: 300,
              color: 'rgba(255,255,255,0.35)',
              marginLeft: 18,
              alignSelf: 'flex-end',
              paddingBottom: SZ * 0.16,
              letterSpacing: '0.08em',
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
        fontSize: 16,
        fontWeight: 300,
        color: 'rgba(255,255,255,0.18)',
        letterSpacing: '0.22em',
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
            transition={{ duration: 0.6 }}
            style={{
              position: 'absolute',
              bottom: 32,
              left: '50%',
              transform: 'translateX(-50%)',
              fontFamily: "'Inter Variable', Inter, sans-serif",
              fontSize: 11,
              color: 'rgba(255,255,255,0.18)',
              letterSpacing: '0.1em',
              whiteSpace: 'nowrap',
            }}
          >
            T 键切换 12h / 24h · 双击切换 · ESC 退出
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
