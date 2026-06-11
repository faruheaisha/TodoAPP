import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusStore, focusDurationFor } from '../store/focusStore';
import { useTodoStore } from '../store/todoStore';
import { useOverlayStore } from '../store/overlayStore';
import '@fontsource/dm-mono/300.css';
import '@fontsource/dm-mono/400.css';

const RING_R    = 344;
const RING_CIRC = 2 * Math.PI * RING_R;
const ACCENT    = '#D97757';
const SVG_SIZE  = 820;
const CX        = SVG_SIZE / 2;

const DIGIT_SZ = 204;

const DIGIT_SHADOW = [
  '0 -2px 0 rgba(255,255,255,0.22)',
  '0  1px 0 rgba(255,255,255,0.06)',
  '0  3px 6px rgba(0,0,0,0.90)',
  '0  8px 20px rgba(0,0,0,0.75)',
  '0 20px 52px rgba(0,0,0,0.55)',
  '0  0  90px rgba(217,119,87,0.10)',
].join(', ');

function Digit({ val }: { val: string }) {
  return (
    <div style={{
      position: 'relative',
      width: DIGIT_SZ * 0.58,
      height: DIGIT_SZ * 1.08,
      overflow: 'hidden',
      willChange: 'transform',
      backfaceVisibility: 'hidden',
      transform: 'translateZ(0)',
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
            fontFamily: "'DM Mono', 'Cascadia Code', monospace",
            fontSize: DIGIT_SZ,
            fontWeight: 300,
            color: '#EDE8DC',
            letterSpacing: '-0.04em',
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

function Colon() {
  return (
    <span style={{
      fontFamily: "'DM Mono', 'Cascadia Code', monospace",
      fontSize: DIGIT_SZ * 0.65,
      fontWeight: 100,
      color: 'rgba(255,255,255,0.50)',
      lineHeight: 1,
      margin: `0 ${DIGIT_SZ * 0.02}px`,
      userSelect: 'none',
      textShadow: '0 -1px 0 rgba(255,255,255,0.18), 0 4px 12px rgba(0,0,0,0.85)',
      alignSelf: 'center',
      paddingBottom: DIGIT_SZ * 0.04,
    }}>:</span>
  );
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function setWindowFullscreen(full: boolean) {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    await win.setFullscreen(full);
    await win.setAlwaysOnTop(full);
  } catch { /* dev */ }
}

export default function FocusLockScreen() {
  const { closeFocusLock } = useOverlayStore();
  const { mode, remainingSeconds, isRunning, settings, linkedTodoId } = useFocusStore();
  const todos = useTodoStore((s) => s.todos);
  const linkedTodo = todos.find((t) => t.id === linkedTodoId) ?? null;
  const [clockStr, setClockStr] = useState(nowTime);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setWindowFullscreen(true);
    return () => { setWindowFullscreen(false); };
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => useFocusStore.getState().tick(Date.now()), 250);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning]);

  useEffect(() => {
    const id = setInterval(() => setClockStr(nowTime()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeFocusLock(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeFocusLock]);

  const total        = focusDurationFor(mode, settings);
  const progress     = total > 0 ? (total - remainingSeconds) / total : 0;
  const strokeOffset = RING_CIRC * progress;
  const modeLabel    = mode === 'work' ? '专注中' : mode === 'shortBreak' ? '短休息' : '长休息';
  const progressPct  = Math.round(progress * 100);

  const mm = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const ss = String(remainingSeconds % 60).padStart(2, '0');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      onDoubleClick={closeFocusLock}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        userSelect: 'none', cursor: 'none',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: 32, right: 40,
        fontFamily: "'DM Mono', 'Cascadia Code', monospace",
        fontSize: 13, color: 'rgba(255,255,255,0.38)', letterSpacing: '0.1em',
      }}>
        {clockStr}
      </div>

      <div style={{
        position: 'absolute', top: 32, left: 40,
        fontFamily: "'DM Mono', 'Cascadia Code', monospace",
        fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em',
      }}>
        {progressPct}%
      </div>

      <div style={{
        position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
        fontFamily: "'DM Mono', 'Cascadia Code', monospace",
        fontSize: 11, color: 'rgba(255,255,255,0.30)',
        letterSpacing: '0.1em', whiteSpace: 'nowrap',
      }}>
        双击任意位置 · ESC 退出专注锁屏
      </div>

      <div style={{ position: 'relative', width: SVG_SIZE, height: SVG_SIZE }}>
        <svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
          {isRunning && (
            <>
              <motion.circle cx={CX} cy={CX} r={RING_R + 48}
                fill="none" stroke={ACCENT} strokeWidth={1} opacity={0}
                animate={{ opacity: [0, 0.08, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.circle cx={CX} cy={CX} r={RING_R + 26}
                fill="none" stroke={ACCENT} strokeWidth={2} opacity={0}
                animate={{ opacity: [0, 0.16, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
              />
            </>
          )}
          <circle cx={CX} cy={CX} r={RING_R}
            fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={36} />
          <circle cx={CX} cy={CX} r={RING_R}
            fill="none" stroke="rgba(217,119,87,0.07)" strokeWidth={36} />
          <motion.circle
            cx={CX} cy={CX} r={RING_R}
            fill="none" stroke="url(#ringGrad)"
            strokeWidth={36} strokeLinecap="round"
            strokeDasharray={RING_CIRC}
            animate={{ strokeDashoffset: strokeOffset }}
            transition={{ duration: 0.3, ease: 'linear' }}
            transform={`rotate(-90 ${CX} ${CX})`}
          />
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E8956A" />
              <stop offset="100%" stopColor="#D97757" />
            </linearGradient>
          </defs>
        </svg>

        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Digit val={mm[0]} />
            <Digit val={mm[1]} />
            <Colon />
            <Digit val={ss[0]} />
            <Digit val={ss[1]} />
          </div>
          <span style={{
            fontFamily: "'DM Mono', 'Cascadia Code', monospace",
            fontSize: 13, fontWeight: 400,
            color: 'rgba(255,255,255,0.40)',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
          }}>
            {modeLabel}
          </span>
        </div>
      </div>

      <AnimatePresence>
        {linkedTodo && mode === 'work' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            style={{
              marginTop: 40,
              display: 'flex', alignItems: 'center', gap: 10,
              maxWidth: 400,
            }}
          >
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              backgroundColor: ACCENT, flexShrink: 0,
              boxShadow: `0 0 8px ${ACCENT}`,
            }} />
            <span style={{
              fontFamily: "'DM Mono', 'Cascadia Code', monospace",
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
