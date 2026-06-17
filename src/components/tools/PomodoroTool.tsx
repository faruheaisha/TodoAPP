/**
 * PomodoroTool — 番茄钟工具面板内容
 *
 * 1:1 匹配 claude_design/ai-suite/PomodoroTool.jsx 的视觉布局，
 * 保留现有的 focusStore / overlayStore 驱动逻辑。
 *
 * 视觉特征：
 * - 顶部：分段选择器（专注/短休/长休）+ 专注锁屏/屏保图标按钮
 * - SVG 圆环：268x268 viewBox, r=112, strokeWidth=10, 线性进度
 * - Flip digits：48px tabular-nums，逐位翻转动画
 * - 圆点：8px 半径，已完成 coral 实心，未完成透明+边框
 * - 任务选择器：link 图标 + 选择按钮，下拉列表（非触屏用 dropdown，触屏用 search-overlay）
 * - 控制按钮：64px coral 圆形 play/pause，reset 和 skip 用图标按钮 + tooltip
 * - 底部：累计完成文案
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, RotateCcw, SkipForward, Timer, Moon, Lock, Link2,
  ChevronDown, BrainCircuit, Coffee, AudioLines,
} from 'lucide-react';
import {
  useFocusStore,
  type FocusMode,
  focusDurationFor,
} from '../../store/focusStore';
import { useTodoStore } from '../../store/todoStore';
import { useToolsPanelStore } from '../../store/toolsStore';
import { useOverlayStore } from '../../store/overlayStore';
import { useToast } from '../Toast';
/* DM Mono — ClockScreen 同款等宽数字字体 */
import '@fontsource/dm-mono/300.css';
import '@fontsource/dm-mono/400.css';

/* ─── 阶段元数据 ─── */
const MODE_META: Record<FocusMode, { icon: typeof BrainCircuit; labelKey: string; shortKey: string; ring: string }> = {
  work:       { icon: Timer,      labelKey: 'pomodoro.modeWork',       shortKey: 'pomodoro.shortWork',       ring: 'var(--clay)' },
  shortBreak: { icon: Coffee,     labelKey: 'pomodoro.modeShortBreak',  shortKey: 'pomodoro.shortShortBreak',  ring: '#5B9E78' },
  longBreak:  { icon: Moon,       labelKey: 'pomodoro.modeLongBreak',   shortKey: 'pomodoro.shortLongBreak',   ring: '#5E8BC0' },
};

const DIGIT_W = 42; // 72 * 0.58
const DIGIT_H = 78; // 72 * 1.08

/* ─── 时长约束 ─── */
const CONSTRAINTS = {
  work:       { min: 15, max: 480 },
  shortBreak: { min: 0,  max: 30 },
  longBreak:  { min: 5,  max: 60 },
} as const;

/* ─── FlipTime: ClockScreen 完全对齐 ─── */

function DigitBox({ val }: { val: string }) {
  return (
    <div style={{
      position: 'relative',
      width: DIGIT_W,
      height: DIGIT_H,
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
          animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '65%', opacity: 0, filter: 'blur(6px)' }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'absolute',
            fontFamily: "'DM Mono', 'Cascadia Code', monospace",
            fontSize: 72,
            fontWeight: 300,
            color: 'var(--color-text-primary)',
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

function FlipTime({ total }: { total: number }) {
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {mm.split('').map((c, i) => (
        <DigitBox key={'m' + i} val={c} />
      ))}
      <span
        style={{
          opacity: 0.4,
          fontFamily: "'DM Mono', 'Cascadia Code', monospace",
          fontSize: 72,
          fontWeight: 300,
          lineHeight: 1,
          margin: '0 2px',
        }}
      >
        :
      </span>
      {ss.split('').map((c, i) => (
        <DigitBox key={'s' + i} val={c} />
      ))}
    </div>
  );
}

/* ─── RoundDots: 8px 圆点进度 ─── */
function RoundDots({ done, total = 5 }: { done: number; total?: number }) {
  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: i < done ? 'var(--clay)' : 'transparent',
            border: i < done ? 'none' : '1.4px solid var(--color-border)',
          }}
        />
      ))}
    </div>
  );
}

/* ─── IconBtn: 带 hover tooltip 的图标按钮 ─── */
function IconBtn({
  icon,
  tip,
  onClick,
  style,
}: {
  icon: React.ReactNode;
  tip: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  const [h, setH] = useState(false);

  return (
    <div
      style={{ position: 'relative', ...style }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
    >
      <button
        className="ghost"
        onClick={onClick}
        style={{
          padding: 7,
          cursor: 'pointer',
          border: 'none',
          background: 'transparent',
          color: 'var(--color-text-tertiary)',
          display: 'grid',
          placeItems: 'center',
          borderRadius: 6,
          transition: 'color 150ms ease, background 150ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-text-primary)';
          e.currentTarget.style.background = 'var(--color-bg-tertiary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-tertiary)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        {icon}
      </button>
      {h && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--slate)',
            color: '#fff',
            fontSize: 11,
            padding: '4px 8px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            zIndex: 5,
            pointerEvents: 'none',
          }}
        >
          {tip}
        </div>
      )}
    </div>
  );
}

/* ─── 分段选择器 Segmented — 匹配 Struct 风格 ─── */
function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (k: string) => void;
  options: { k: string; label: string }[];
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 3,
        padding: 4,
        background: 'var(--ivory-md)',
        border: '0.5px solid var(--color-border)',
        borderRadius: 10,
      }}
    >
      {options.map((opt) => {
        const active = value === opt.k;
        return (
          <button
            key={opt.k}
            onClick={() => onChange(opt.k)}
            style={{
              padding: '6px 14px',
              border: 'none',
              borderRadius: 7,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: active ? 600 : 450,
              color: active ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              background: active ? '#fff' : 'transparent',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 150ms ease',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              fontFamily: 'inherit',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── 主组件 ─── */
export function PomodoroTool() {
  const { t } = useTranslation();
  const { show } = useToast();

  const {
    settings,
    mode,
    remainingSeconds,
    isRunning,
    completedWorkSessions,
    cycleCount,
    remainingCycles,
    linkedTodoId,
    loopMode,
    loopCycles,
    start,
    pause,
    reset,
    tick,
    switchMode,
    updateSettings,
    setLinkedTodo,
    setLoopMode,
    setLoopCycles,
  } = useFocusStore();

  const todos = useTodoStore((s) => s.todos);
  const activeTodos = todos.filter((todo) => !todo.completed);
  const linkedTodo = activeTodos.find((todo) => todo.id === linkedTodoId) ?? null;
  const { openFocusLock, openClock } = useOverlayStore();
  const setActiveTool = useToolsPanelStore((s) => s.setActiveTool);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [linkOpen, setLinkOpen] = useState(false);
  const [bounce, setBounce] = useState(false);

  /* ─── 约束 Toast ─── */
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 3000);
  }, []);
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  /* slide-in 容器 ref — Toast portal 目标 */
  const slideInRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    slideInRef.current = document.querySelector('.slide-in');
  }, []);

  /* 节拍循环 */
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        useFocusStore.getState().tick(Date.now());
      }, 250);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [isRunning]);

  /* 监听阶段完成事件 — 触发 bounce 动画 */
  useEffect(() => {
    function handleComplete(e: Event) {
      const detail = (e as CustomEvent).detail as { finishedMode: FocusMode; nextMode: FocusMode };
      setBounce(true);
      setTimeout(() => setBounce(false), 700);

      const finishedKey = MODE_META[detail.finishedMode].labelKey;
      show(t('pomodoro.sessionDoneToast', { mode: t(finishedKey) }), 'success');

      if (useFocusStore.getState().settings.soundEnabled) {
        notifySessionDone(t('pomodoro.sessionDoneToast', { mode: t(finishedKey) }));
      }
    }
    window.addEventListener('focus-session-complete', handleComplete);
    return () => window.removeEventListener('focus-session-complete', handleComplete);
  }, [show, t]);

  /* 从退出恢复时弹窗询问是否继续循环 */
  const [showResume, setShowResume] = useState(false);
  useEffect(() => {
    if (useFocusStore.getState().pausedOnExit) {
      useFocusStore.getState().setPausedOnExit(false);
      setShowResume(true);
    }
  }, []);

  const handleResumeYes = useCallback(() => {
    setShowResume(false);
    start();
  }, [start]);

  const handleResumeNo = useCallback(() => {
    setShowResume(false);
    reset();
  }, [reset]);

  /* 外部切换阶段（从 segmented） */
  const handleSwitchPhase = useCallback(
    (k: string) => {
      switchMode(k as FocusMode);
      setLinkOpen(false);
    },
    [switchMode],
  );

  const ph = MODE_META[mode];
  const ModeIcon = ph.icon;
  const total = focusDurationFor(mode, settings);
  const progress = total > 0 ? (total - remainingSeconds) / total : 0;

  /* SVG 圆环参数 — 等比放大 */
  const R = 130;
  const C = 2 * Math.PI * R;

  return (
    <div
      style={{
        position: 'relative',
        padding: '4px 28px 26px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
      }}
    >
      {/* ─── Header row：左侧 Segmented + 右侧图标按钮 ─── */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Segmented
          value={mode}
          onChange={handleSwitchPhase}
          options={[
            { k: 'work', label: t('pomodoro.shortWork') },
            { k: 'shortBreak', label: t('pomodoro.shortShortBreak') },
            { k: 'longBreak', label: t('pomodoro.shortLongBreak') },
          ]}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <IconBtn
            icon={<Lock size={20} />}
            tip={t('pomodoro.focusLockTip')}
            onClick={() => openFocusLock()}
          />
          <IconBtn
            icon={<Moon size={20} />}
            tip={t('pomodoro.screensaverTip')}
            onClick={() => openClock()}
          />
        </div>
      </div>

      {/* ─── SVG 计时圆环 — 等比放大 ─── */}
      <div
        style={{
          position: 'relative',
          width: 310,
          height: 310,
          animation: bounce ? 'ringBounce 0.65s ease' : 'none',
        }}
      >
        <svg width="310" height="310" viewBox="0 0 310 310" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx="155"
            cy="155"
            r={R}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="10"
          />
          <circle
            cx="155"
            cy="155"
            r={R}
            fill="none"
            stroke={ph.ring}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * progress}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <span style={{ color: ph.ring }}>
            <ModeIcon size={24} />
          </span>
          <FlipTime total={remainingSeconds} />
          <span style={{ fontSize: 14, color: 'var(--color-text-tertiary)', fontWeight: 500 }}>
            {t(ph.labelKey)}
          </span>
        </div>
      </div>

      {/* ─── 任务选择器（匹配设计稿 Chip 风格）─── */}
      <div style={{ width: '100%', maxWidth: 360, position: 'relative' }}>
        {linkedTodo ? (
          <button
            onClick={() => setLinkOpen((o) => !o)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 12px',
              borderRadius: 10,
              border: '0.5px solid var(--clay-light)',
              background: 'var(--clay-light)',
              cursor: 'pointer',
              font: 'inherit',
              color: 'var(--color-text-primary)',
            }}
          >
            <span style={{ color: 'var(--clay)' }}>
              <Link2 size={15} />
            </span>
            <span
              style={{
                fontSize: 13,
                flex: 1,
                textAlign: 'left',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {linkedTodo.title}
            </span>
            <ChevronDown size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
          </button>
        ) : (
          <button
            onClick={() => setLinkOpen((o) => !o)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 12px',
              borderRadius: 10,
              border: '0.5px solid var(--color-border)',
              background: 'var(--color-bg-secondary)',
              cursor: 'pointer',
              font: 'inherit',
              color: 'var(--color-text-tertiary)',
            }}
          >
            <Link2 size={15} />
            <span style={{ fontSize: 13, flex: 1, textAlign: 'left' }}>
              {t('pomodoro.selectTodo')}
            </span>
            <ChevronDown size={14} style={{ flexShrink: 0 }} />
          </button>
        )}

        {/* 下拉列表 */}
        <AnimatePresence>
          {linkOpen && (
            <>
              {/* 外部点击关闭 */}
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                onClick={() => setLinkOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -2, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  zIndex: 100,
                  background: 'var(--color-bg-secondary)',
                  border: '0.5px solid var(--color-border)',
                  borderRadius: 10,
                  boxShadow: 'var(--shadow-md)',
                  padding: 5,
                }}
              >
                {activeTodos.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '12px 0',
                      fontSize: 12,
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    {t('pomodoro.noTodo')}
                  </div>
                ) : (
                  <>
                    {linkedTodo && (
                      <button
                        onClick={() => {
                          setLinkedTodo(null);
                          setLinkOpen(false);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          border: 'none',
                          cursor: 'pointer',
                          font: 'inherit',
                          fontSize: 13,
                          color: 'var(--color-text-tertiary)',
                          padding: '8px 10px',
                          borderRadius: 7,
                          background: 'transparent',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-tertiary)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {t('pomodoro.unlink')}
                      </button>
                    )}
                    {activeTodos.map((todo) => (
                      <button
                        key={todo.id}
                        onClick={() => {
                          setLinkedTodo(todo.id);
                          setLinkOpen(false);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          border: 'none',
                          cursor: 'pointer',
                          font: 'inherit',
                          fontSize: 13,
                          color: linkedTodo?.id === todo.id ? 'var(--clay)' : 'var(--color-text-primary)',
                          padding: '8px 10px',
                          borderRadius: 7,
                          background: 'transparent',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-tertiary)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {todo.title}
                      </button>
                    ))}
                  </>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* ─── 控制按钮 ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <IconBtn
          icon={<RotateCcw size={22} />}
          tip={t('pomodoro.reset')}
          onClick={() => reset()}
        />

        <button
          onClick={() => (isRunning ? pause() : start())}
          style={{
            width: 76,
            height: 76,
            borderRadius: '50%',
            border: 'none',
            cursor: 'pointer',
            background: 'var(--clay)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 8px 20px -6px rgba(217, 119, 87, 0.6)',
            transition: 'transform 0.1s, filter 0.14s',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          {isRunning ? <Pause size={30} /> : <Play size={30} style={{ marginLeft: 2 }} />}
        </button>

        <IconBtn
          icon={<SkipForward size={22} />}
          tip={t('pomodoro.skip')}
          onClick={() => {
            const order: FocusMode[] = ['work', 'shortBreak', 'work', 'longBreak'];
            const idx = order.indexOf(mode);
            const next = order[(idx + 1) % order.length] || 'work';
            switchMode(next);
          }}
        />
      </div>

      {/* ─── 圆点 + 累计文案 ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <RoundDots done={cycleCount % settings.longBreakInterval} total={settings.longBreakInterval} />
        <span style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
          {t('pomodoro.totalCompleted', { count: completedWorkSessions })}
        </span>
      </div>

      {/* ─── 音景快捷入口 ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 360 }}>
        <button
          onClick={() => setActiveTool('soundscape')}
          style={{
            display: 'flex',
            alignItems: 'center',
            flex: 1,
            gap: 6,
            padding: '8px 12px',
            borderRadius: 8,
            border: '0.5px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            justifyContent: 'center',
            fontFamily: 'inherit',
          }}
          title={t('tools.soundscape')}
        >
          <AudioLines size={12} />
          {t('tools.soundscape')}
        </button>
      </div>

      {/* ─── 时长设置 ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', maxWidth: 360 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-text-tertiary)',
          }}
        >
          {t('pomodoro.durationSettings')}
        </span>
        <DurationRow
          label={t('pomodoro.modeWork')}
          value={settings.workMinutes}
          field="work"
          onChange={(v) => updateSettings({ workMinutes: v })}
          showToast={showToast}
          t={t}
        />
        <DurationRow
          label={t('pomodoro.modeShortBreak')}
          value={settings.shortBreakMinutes}
          field="shortBreak"
          onChange={(v) => updateSettings({ shortBreakMinutes: v })}
          showToast={showToast}
          t={t}
        />
        <DurationRow
          label={t('pomodoro.modeLongBreak')}
          value={settings.longBreakMinutes}
          field="longBreak"
          onChange={(v) => updateSettings({ longBreakMinutes: v })}
          showToast={showToast}
          t={t}
        />
        {/* ─── 循环模式 ─── */}
        <div className="flex items-center justify-between" style={{ padding: '6px 0' }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
            {t('pomodoro.loopMode')}
          </span>
          <div className="flex items-center" style={{ gap: 4 }}>
            {(['off', 'cycle', 'infinite'] as const).map((val) => (
              <button
                key={val}
                onClick={() => setLoopMode(val)}
                className="cursor-pointer"
                style={{
                  padding: '4px 10px', borderRadius: 6, border: '0.5px solid var(--color-border)',
                  fontSize: 11, fontWeight: loopMode === val ? 600 : 400,
                  background: loopMode === val ? 'var(--clay)' : 'transparent',
                  color: loopMode === val ? '#fff' : 'var(--color-text-tertiary)',
                  fontFamily: 'inherit', transition: 'all 0.12s',
                }}
              >
                {val === 'off' ? t('pomodoro.loopOff') : val === 'cycle' ? t('pomodoro.loopCycle') : t('pomodoro.loopInfinite')}
              </button>
            ))}
          </div>
        </div>
        {loopMode === 'cycle' && (
          <div className="flex items-center justify-between" style={{ padding: '0 0 6px' }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              {t('pomodoro.loopCyclesLabel')}
            </span>
            <div className="flex items-center" style={{ gap: 6 }}>
              <PressStepper onClick={() => setLoopCycles(loopCycles - 1)} disabled={isRunning && remainingCycles <= 1}>{'−'}</PressStepper>
              <span style={{
                fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                minWidth: 20, textAlign: 'center',
                color: remainingCycles < loopCycles ? 'var(--clay)' : 'var(--color-text-primary)',
                transition: 'color 0.3s',
              }}>
                {remainingCycles}
              </span>
              <PressStepper onClick={() => setLoopCycles(loopCycles + 1)} disabled={isRunning && remainingCycles <= 1}>+</PressStepper>
            </div>
          </div>
        )}
        {loopMode === 'cycle' && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            fontSize: 12, color: 'var(--clay)', fontWeight: 600,
            background: 'var(--clay-light)', borderRadius: 8,
            padding: '10px 12px', lineHeight: 1.4, marginBottom: 4,
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: '50%',
              background: 'var(--clay)', color: '#fff',
              fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}>
              {remainingCycles === loopCycles ? loopCycles : loopCycles - remainingCycles + 1}
            </span>
            <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>
              / {loopCycles} 轮
            </span>
          </div>
        )}
        {loopMode === 'infinite' && (
          <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 400, textAlign: 'center', letterSpacing: '0.06em', lineHeight: 1.5, padding: '0 0 4px' }}>
            {t('pomodoro.loopInfiniteHint')}
          </div>
        )}
      </div>

      {/* ─── 退出恢复弹窗 ─── */}
      <AnimatePresence>
        {showResume && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.3)' }} onClick={handleResumeNo} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
              exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
              transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
              style={{
                position: 'fixed', top: '50%', left: '50%',
                zIndex: 201, background: 'var(--color-bg-primary)',
                border: '0.5px solid var(--color-border)',
                borderRadius: 14, padding: '24px 28px',
                minWidth: 280, maxWidth: 360,
                display: 'flex', flexDirection: 'column', gap: 16,
                boxShadow: '0 12px 40px -8px rgba(0,0,0,0.25)',
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {t('pomodoro.resumeTitle')}
              </span>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                {t('pomodoro.resumeDesc')}
              </span>
              <div className="flex items-center" style={{ gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={handleResumeNo}
                  className="cursor-pointer"
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: '0.5px solid var(--color-border)',
                    background: 'transparent', fontSize: 13, color: 'var(--color-text-secondary)',
                    fontFamily: 'inherit',
                  }}
                >
                  {t('pomodoro.resumeNo')}
                </button>
                <button
                  onClick={handleResumeYes}
                  className="cursor-pointer"
                  style={{
                    padding: '8px 20px', borderRadius: 8, border: 'none',
                    background: 'var(--clay)', fontSize: 13, fontWeight: 600,
                    color: '#fff', fontFamily: 'inherit',
                  }}
                >
                  {t('pomodoro.resumeYes')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 时长约束 Toast — portal 到滚动容器内居中 */}
      {slideInRef.current && createPortal(
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 200, pointerEvents: 'none' }}>
          <AnimatePresence>
            {toastMsg && (
              <motion.div
                key="constraint-toast"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
                style={{
                  maxWidth: 320, padding: '16px 24px', borderRadius: 12,
                  background: 'var(--color-bg-primary)',
                  border: '0.5px solid var(--color-border)',
                  boxShadow: '0 8px 32px -8px rgba(0,0,0,0.2)',
                  fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)',
                  textAlign: 'center', lineHeight: 1.6, whiteSpace: 'pre-line',
                }}
              >
                {toastMsg}
              </motion.div>
            )}
          </AnimatePresence>
        </div>,
        slideInRef.current
      )}
    </div>
  );
}

/* ─── DurationRow：时长设置行（含约束校验 + Toast） ─── */
function DurationRow({
  label, value, field, onChange, showToast, t,
}: {
  label: string;
  value: number;
  field: 'work' | 'shortBreak' | 'longBreak';
  onChange: (v: number) => void;
  showToast: (msg: string) => void;
  t: (key: string, opts?: any) => string;
}) {
  const c = CONSTRAINTS[field];

  const handleDecrease = () => {
    const next = value - 1;
    if (next < c.min) {
      if (field === 'work') showToast(t('pomodoro.toastWorkMin'));
      if (field === 'longBreak') showToast(t('pomodoro.toastLongBreakMin'));
      return;
    }
    onChange(next);
  };

  const handleIncrease = () => {
    const next = value + 1;
    if (next > c.max) {
      if (field === 'shortBreak' || field === 'longBreak') showToast(t('pomodoro.toastRestMax'));
      if (field === 'work') showToast(t('pomodoro.toastWorkMax'));
      return;
    }
    onChange(next);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: '0.5px solid var(--color-separator)',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <PressStepper onClick={handleDecrease}>{'−'}</PressStepper>
        <span
          style={{
            width: 28,
            textAlign: 'center',
            fontSize: 12,
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-primary)',
          }}
        >
          {value}
        </span>
        <PressStepper onClick={handleIncrease}>+</PressStepper>
      </div>
    </div>
  );
}

/* ─── PressStepper：支持长按连续增减 ─── */
function PressStepper({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  const clear = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  useEffect(() => clear, [clear]);

  const handleMouseDown = () => {
    if (disabled) return;
    onClickRef.current();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => onClickRef.current(), 50);
    }, 200);
  };

  return (
    <button
      onMouseDown={handleMouseDown}
      onMouseUp={clear}
      onMouseLeave={(e) => {
        clear();
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = disabled ? 'var(--color-border)' : 'var(--color-text-secondary)';
      }}
      style={{
        width: 20,
        height: 20,
        borderRadius: 4,
        border: '1px solid var(--color-border)',
        background: 'transparent',
        color: disabled ? 'var(--color-border)' : 'var(--color-text-secondary)',
        fontSize: 11,
        lineHeight: 1,
        display: 'grid',
        placeItems: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        transition: 'background 150ms ease, color 150ms ease',
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = 'var(--color-bg-tertiary)';
        e.currentTarget.style.color = 'var(--color-text-primary)';
      }}
    >
      {children}
    </button>
  );
}

/* ─── 系统通知（静默降级） ─── */
async function notifySessionDone(body: string) {
  try {
    const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === 'granted';
    }
    if (granted) {
      sendNotification({ title: 'TodoApp', body });
    }
  } catch (e) {
    console.warn('Pomodoro notification skipped:', e);
  }
}
