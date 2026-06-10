import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusStore, focusDurationFor } from '../store/focusStore';
import { useTranslation } from 'react-i18next';
import '../i18n/index';

/**
 * FocusLockScreen — 专注锁屏窗口
 *
 * 设计灵感：Customodoro "Locked-In Mode" —— 一切淡出，只剩倒计时。
 * 全黑背景，大号倒计时圆环，任务名，呼吸光晕，当前时间（角落）。
 * 按 ESC 关闭窗口。
 */

const RING_R = 120;
const RING_CIRC = 2 * Math.PI * RING_R;

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function FocusLockScreen() {
  const { t } = useTranslation();
  const { mode, remainingSeconds, isRunning, settings, linkedTodoId } = useFocusStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [clockStr, setClockStr] = useState(nowTime());

  // Keep ticking the store from this window too (in case main window is hidden)
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        useFocusStore.getState().tick();
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning]);

  // Update corner clock
  useEffect(() => {
    const id = setInterval(() => setClockStr(nowTime()), 1000);
    return () => clearInterval(id);
  }, []);

  // ESC → close window
  useEffect(() => {
    async function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        getCurrentWindow().close();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const total = focusDurationFor(mode, settings);
  const progress = total > 0 ? (total - remainingSeconds) / total : 0;
  const dashOffset = RING_CIRC * (1 - progress); // drain: full → empty

  // Accent color matching main app (coral default)
  const ringColor = '#D97757';

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
      }}
    >
      {/* Corner clock */}
      <div
        style={{
          position: 'absolute',
          top: 28,
          right: 36,
          fontFamily: "'Inter Variable', Inter, monospace",
          fontSize: '13px',
          color: 'rgba(255,255,255,0.25)',
          letterSpacing: '0.08em',
        }}
      >
        {clockStr}
      </div>

      {/* ESC hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: "'Inter Variable', Inter, sans-serif",
          fontSize: '11px',
          color: 'rgba(255,255,255,0.18)',
          letterSpacing: '0.1em',
        }}
      >
        按 ESC 退出锁屏
      </div>

      {/* Main ring */}
      <div style={{ position: 'relative', width: 300, height: 300 }}>
        <svg width={300} height={300} viewBox="0 0 300 300">
          {/* Outer breathing glow */}
          {isRunning && (
            <motion.circle
              cx={150} cy={150} r={RING_R + 20}
              fill="none"
              stroke={ringColor}
              strokeWidth={2}
              opacity={0}
              animate={{ opacity: [0, 0.15, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          {/* Track */}
          <circle
            cx={150} cy={150} r={RING_R}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={12}
          />
          {/* Progress arc */}
          <motion.circle
            cx={150} cy={150} r={RING_R}
            fill="none"
            stroke={ringColor}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={RING_CIRC}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.5, ease: 'linear' }}
            transform="rotate(-90 150 150)"
          />
        </svg>

        {/* Center content */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <motion.span
            key={remainingSeconds}
            initial={{ opacity: 0.6, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            style={{
              fontFamily: "'Inter Variable', Inter, monospace",
              fontSize: '60px',
              fontWeight: 300,
              color: '#fff',
              letterSpacing: '0.04em',
              lineHeight: 1,
            }}
          >
            {fmt(remainingSeconds)}
          </motion.span>
          <span
            style={{
              fontFamily: "'Inter Variable', Inter, sans-serif",
              fontSize: '12px',
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            {mode === 'work' ? '专注' : mode === 'shortBreak' ? '短休息' : '长休息'}
          </span>
        </div>
      </div>

      {/* Task name (if linked) */}
      <AnimatePresence>
        {linkedTodoId && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            style={{
              marginTop: 28,
              maxWidth: 320,
              textAlign: 'center',
              fontFamily: "'Inter Variable', Inter, sans-serif",
              fontSize: '14px',
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: '0.02em',
              lineHeight: 1.5,
            }}
          >
            <span style={{ color: ringColor, marginRight: 6 }}>●</span>
            <TodoTitle todoId={linkedTodoId} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Lazy load todo title to avoid import cycle
function TodoTitle({ todoId }: { todoId: string }) {
  const [title, setTitle] = useState('');
  useEffect(() => {
    import('../store/todoStore').then(({ useTodoStore }) => {
      const todo = useTodoStore.getState().todos.find(t => t.id === todoId);
      if (todo) setTitle(todo.title);
    });
  }, [todoId]);
  return <>{title}</>;
}
