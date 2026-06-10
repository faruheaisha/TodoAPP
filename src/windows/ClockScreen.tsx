import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOverlayStore } from '../store/overlayStore';

/**
 * ClockScreen — 时间流动屏保
 *
 * 大号立体数字，每位独立翻牌动效，全黑背景。
 * 双击退出；角落按钮切换 12h/24h。
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

// Multi-layer text-shadow for 3D depth
const DIGIT_SHADOW = [
  '0 1px 0 rgba(255,255,255,0.07)',
  '0 2px 2px rgba(0,0,0,0.7)',
  '0 4px 8px rgba(0,0,0,0.6)',
  '0 8px 24px rgba(0,0,0,0.5)',
  '0 0 60px rgba(217,119,87,0.08)',
].join(', ');

function Digit({ val, size }: { val: string; size: number }) {
  return (
    <div style={{
      position: 'relative',
      width: size * 0.6,
      height: size * 1.1,
      overflow: 'hidden',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={val}
          initial={{ y: '-60%', opacity: 0, filter: 'blur(4px)' }}
          animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '60%', opacity: 0, filter: 'blur(4px)' }}
          transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{
            position: 'absolute',
            fontFamily: "'Inter Variable', Inter, monospace",
            fontSize: size,
            fontWeight: 200,
            color: '#F8F4EF',
            letterSpacing: '-0.03em',
            lineHeight: 1,
            textShadow: DIGIT_SHADOW,
          }}
        >
          {val}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function Colon({ size }: { size: number }) {
  return (
    <span style={{
      fontFamily: "'Inter Variable', Inter, monospace",
      fontSize: size * 0.7,
      fontWeight: 100,
      color: 'rgba(255,255,255,0.15)',
      lineHeight: 1,
      margin: `0 ${size * 0.04}px`,
      userSelect: 'none',
      textShadow: '0 2px 8px rgba(0,0,0,0.8)',
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeClock(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeClock]);

  const SZ = 160;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      onDoubleClick={closeClock}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        userSelect: 'none', cursor: 'none',
      }}
    >
      {/* 12h/24h toggle — top right corner */}
      <button
        onDoubleClick={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); setUse24h(v => !v); }}
        style={{
          position: 'absolute', top: 28, right: 36,
          fontFamily: "'Inter Variable', Inter, sans-serif",
          fontSize: 11, color: 'rgba(255,255,255,0.22)',
          letterSpacing: '0.12em',
          background: 'transparent', border: 'none',
          cursor: 'pointer', padding: '4px 8px',
          borderRadius: 4,
          transition: 'color 0.2s',
        }}
      >
        {use24h ? '24H' : '12H'}
      </button>

      {/* Clock */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Digit val={parts.h[0]} size={SZ} />
        <Digit val={parts.h[1]} size={SZ} />
        <Colon size={SZ} />
        <Digit val={parts.m[0]} size={SZ} />
        <Digit val={parts.m[1]} size={SZ} />
        <Colon size={SZ} />
        <Digit val={parts.s[0]} size={SZ} />
        <Digit val={parts.s[1]} size={SZ} />

        {parts.ampm && (
          <motion.span
            key={parts.ampm}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              fontFamily: "'Inter Variable', Inter, sans-serif",
              fontSize: 24, fontWeight: 300,
              color: 'rgba(255,255,255,0.3)',
              marginLeft: 20,
              alignSelf: 'flex-end',
              paddingBottom: SZ * 0.15,
              letterSpacing: '0.08em',
              textShadow: '0 2px 8px rgba(0,0,0,0.8)',
            }}
          >
            {parts.ampm}
          </motion.span>
        )}
      </div>

      {/* Date */}
      <div style={{
        marginTop: 24,
        fontFamily: "'Inter Variable', Inter, sans-serif",
        fontSize: 15, fontWeight: 300,
        color: 'rgba(255,255,255,0.16)',
        letterSpacing: '0.24em',
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
              fontSize: 11, color: 'rgba(255,255,255,0.16)',
              letterSpacing: '0.1em', whiteSpace: 'nowrap',
            }}
          >
            双击退出 · 右上角切换 12h/24h · ESC 退出
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
