import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusStore, focusDurationFor } from '../store/focusStore';
import { useTodoStore } from '../store/todoStore';
import { useOverlayStore } from '../store/overlayStore';
import '@fontsource/dm-mono/300.css';
import '@fontsource/dm-mono/400.css';

/**
 * FocusLockScreen — 专注锁屏 overlay
 *
 * 设计对标 Costudy "Locked-In Mode"：
 *  - 深色渐变背景（非纯黑，有层次感）
 *  - 大号计时圆环 + 多层光晕
 *  - 中心大字倒计时（90px）
 *  - 任务名沉浸显示
 *  - 开启时 setFullscreen(true) + setAlwaysOnTop(true) 覆盖系统任务栏
 *  - 双击 / ESC 退出
 */

const RING_R = 120;
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

// Trigger Tauri window fullscreen
async function setWindowFullscreen(full: boolean) {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    await win.setFullscreen(full);
    await win.setAlwaysOnTop(full);
  } catch { /* dev / non-Tauri */ }
}

export default function FocusLockScreen() {
  const { closeFocusLock } = useOverlayStore();
  const { mode, remainingSeconds, isRunning, settings, linkedTodoId } = useFocusStore();
  const todos = useTodoStore((s) => s.todos);
  const linkedTodo = todos.find((t) => t.id === linkedTodoId) ?? null;
  const [clockStr, setClockStr] = useState(nowTime);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fullscreen on mount, restore on unmount
  useEffect(() => {
    setWindowFullscreen(true);
    return () => { setWindowFullscreen(false); };
  }, []);

  // Keep ticking while locked
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => useFocusStore.getState().tick(Date.now()), 250);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning]);

  // Corner clock
  useEffect(() => {
    const id = setInterval(() => setClockStr(nowTime()), 1000);
    return () => clearInterval(id);
  }, []);

  // ESC / double-click to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeFocusLock(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeFocusLock]);

  const total = focusDurationFor(mode, settings);
  const progress = total > 0 ? (total - remainingSeconds) / total : 0;
  const strokeOffset = RING_CIRC * progress;
  const modeLabel = mode === 'work' ? '专注中' : mode === 'shortBreak' ? '短休息' : '长休息';

  // Progress: 0→1 as time drains
  const progressPct = Math.round(progress * 100);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      onDoubleClick={closeFocusLock}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        // Costudy-style: deep gradient, not flat black
        background: 'radial-gradient(ellipse at 50% 40%, #1a1520 0%, #0d0b0e 55%, #000 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        userSelect: 'none', cursor: 'default',
        overflow: 'hidden',
      }}
    >
      {/* Ambient background glow — coral tint behind ring */}
      <div style={{
        position: 'absolute',
        width: 600, height: 600,
        borderRadius: '50%',
        background: `radial-gradient(circle, rgba(217,119,87,0.06) 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Corner clock */}
      <div style={{
        position: 'absolute', top: 32, right: 40,
        fontFamily: "'DM Mono', 'Cascadia Code', monospace",
        fontSize: 13, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.1em',
      }}>
        {clockStr}
      </div>

      {/* Progress % top-left */}
      <div style={{
        position: 'absolute', top: 32, left: 40,
        fontFamily: "'DM Mono', 'Cascadia Code', monospace",
        fontSize: 11, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.12em',
      }}>
        {progressPct}%
      </div>

      {/* Hint bottom */}
      <div style={{
        position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
        fontFamily: "'Inter Variable', Inter, sans-serif",
        fontSize: 11, color: 'rgba(255,255,255,0.12)',
        letterSpacing: '0.1em', whiteSpace: 'nowrap',
      }}>
        双击任意位置 · ESC 退出专注锁屏
      </div>

      {/* Main ring */}
      <div style={{ position: 'relative', width: 320, height: 320 }}>
        <svg width={320} height={320} viewBox="0 0 320 320">
          {/* Outer ambient glow ring — pulses when running */}
          {isRunning && (
            <>
              <motion.circle cx={160} cy={160} r={RING_R + 32}
                fill="none" stroke={ACCENT} strokeWidth={1}
                opacity={0}
                animate={{ opacity: [0, 0.10, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.circle cx={160} cy={160} r={RING_R + 18}
                fill="none" stroke={ACCENT} strokeWidth={2}
                opacity={0}
                animate={{ opacity: [0, 0.18, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
              />
            </>
          )}
          {/* Track */}
          <circle cx={160} cy={160} r={RING_R}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={16}
          />
          {/* Subtle second track shadow */}
          <circle cx={160} cy={160} r={RING_R}
            fill="none"
            stroke="rgba(217,119,87,0.08)"
            strokeWidth={16}
          />
          {/* Progress arc */}
          <motion.circle
            cx={160} cy={160} r={RING_R}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth={16}
            strokeLinecap="round"
            strokeDasharray={RING_CIRC}
            animate={{ strokeDashoffset: strokeOffset }}
            transition={{ duration: 0.3, ease: 'linear' }}
            transform="rotate(-90 160 160)"
          />
          {/* Gradient def */}
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E8956A" />
              <stop offset="100%" stopColor="#D97757" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center countdown */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <motion.span
            key={Math.floor(remainingSeconds)}
            initial={{ opacity: 0.5, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            style={{
              fontFamily: "'DM Mono', 'Cascadia Code', monospace",
              fontSize: 80,
              fontWeight: 300,
              color: '#FDFAF7',
              letterSpacing: '-0.01em',
              lineHeight: 1,
              textShadow: [
                '0 2px 4px rgba(0,0,0,0.6)',
                '0 4px 16px rgba(0,0,0,0.4)',
                `0 0 40px rgba(217,119,87,0.15)`,
              ].join(', '),
            }}
          >
            {fmt(remainingSeconds)}
          </motion.span>
          <span style={{
            fontFamily: "'Inter Variable', Inter, sans-serif",
            fontSize: 11, fontWeight: 400,
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}>
            {modeLabel}
          </span>
        </div>
      </div>

      {/* Task name */}
      <AnimatePresence>
        {linkedTodo && mode === 'work' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            style={{
              marginTop: 36,
              display: 'flex', alignItems: 'center', gap: 10,
              maxWidth: 340,
            }}
          >
            {/* Accent dot */}
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              backgroundColor: ACCENT, flexShrink: 0,
              boxShadow: `0 0 8px ${ACCENT}`,
            }} />
            <span style={{
              fontFamily: "'Inter Variable', Inter, sans-serif",
              fontSize: 15, fontWeight: 300,
              color: 'rgba(255,255,255,0.45)',
              letterSpacing: '0.02em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {linkedTodo.title}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
