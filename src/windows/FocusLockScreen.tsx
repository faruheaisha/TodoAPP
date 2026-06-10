import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusStore, focusDurationFor } from '../store/focusStore';
import { useTodoStore } from '../store/todoStore';
import { useOverlayStore } from '../store/overlayStore';

const RING_R = 110;
const RING_CIRC = 2 * Math.PI * RING_R;
const ACCENT = '#D97757';

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function FocusLockScreen() {
  const { closeFocusLock } = useOverlayStore();
  const { mode, remainingSeconds, isRunning, settings, linkedTodoId } = useFocusStore();
  const todos = useTodoStore((s) => s.todos);
  const linkedTodo = todos.find((t) => t.id === linkedTodoId) ?? null;
  const [clockStr, setClockStr] = useState(nowTime);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep ticking while locked
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => useFocusStore.getState().tick(), 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning]);

  // Corner clock
  useEffect(() => {
    const id = setInterval(() => setClockStr(nowTime()), 1000);
    return () => clearInterval(id);
  }, []);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeFocusLock(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeFocusLock]);

  const total = focusDurationFor(mode, settings);
  const progress = total > 0 ? (total - remainingSeconds) / total : 0;
  const strokeOffset = RING_CIRC * progress;
  const modeLabel = mode === 'work' ? '专注中' : mode === 'shortBreak' ? '短休息' : '长休息';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      onDoubleClick={closeFocusLock}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        userSelect: 'none', cursor: 'default',
      }}
    >
      {/* Corner clock */}
      <div style={{
        position: 'absolute', top: 28, right: 36,
        fontFamily: "'Inter Variable', Inter, monospace",
        fontSize: 13, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.08em',
      }}>
        {clockStr}
      </div>

      {/* Hint */}
      <div style={{
        position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        fontFamily: "'Inter Variable', Inter, sans-serif",
        fontSize: 11, color: 'rgba(255,255,255,0.13)',
        letterSpacing: '0.1em', whiteSpace: 'nowrap',
      }}>
        双击任意位置 · ESC 退出
      </div>

      {/* Ring */}
      <div style={{ position: 'relative', width: 280, height: 280 }}>
        <svg width={280} height={280} viewBox="0 0 280 280">
          {isRunning && (
            <motion.circle cx={140} cy={140} r={RING_R + 24}
              fill="none" stroke={ACCENT} strokeWidth={1.5} opacity={0}
              animate={{ opacity: [0, 0.12, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <circle cx={140} cy={140} r={RING_R}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={14}
          />
          <motion.circle
            cx={140} cy={140} r={RING_R}
            fill="none" stroke={ACCENT} strokeWidth={14}
            strokeLinecap="round" strokeDasharray={RING_CIRC}
            animate={{ strokeDashoffset: strokeOffset }}
            transition={{ duration: 0.6, ease: 'linear' }}
            transform="rotate(-90 140 140)"
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>
          <motion.span
            key={remainingSeconds}
            initial={{ opacity: 0.7, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.12 }}
            style={{
              fontFamily: "'Inter Variable', Inter, monospace",
              fontSize: 58, fontWeight: 200,
              color: '#fff', letterSpacing: '0.02em', lineHeight: 1,
            }}
          >
            {fmt(remainingSeconds)}
          </motion.span>
          <span style={{
            fontFamily: "'Inter Variable', Inter, sans-serif",
            fontSize: 11, color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.14em', textTransform: 'uppercase',
          }}>
            {modeLabel}
          </span>
        </div>
      </div>

      {/* Task name */}
      <AnimatePresence>
        {linkedTodo && mode === 'work' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            style={{
              marginTop: 32, maxWidth: 300, textAlign: 'center',
              fontFamily: "'Inter Variable', Inter, sans-serif",
              fontSize: 14, fontWeight: 300,
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.02em', lineHeight: 1.5,
            }}
          >
            <span style={{ color: ACCENT, marginRight: 8, fontSize: 8 }}>●</span>
            {linkedTodo.title}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
