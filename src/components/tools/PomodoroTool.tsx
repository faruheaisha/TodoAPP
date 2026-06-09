import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Coffee, BrainCircuit, Moon } from 'lucide-react';
import {
  useFocusStore,
  type FocusMode,
  focusDurationFor,
} from '../../store/focusStore';
import { useToast } from '../Toast';

/**
 * PomodoroTool — 番茄钟工具面板内容
 *
 * 仅负责 UI 与节拍循环（setInterval → focusStore.tick），
 * 所有状态与跨阶段切换逻辑都在 focusStore 中完成，组件保持「纯展示 + 编排」。
 */

const MODE_META: Record<FocusMode, { icon: typeof BrainCircuit; labelKey: string; ring: string }> = {
  work: { icon: BrainCircuit, labelKey: 'pomodoro.modeWork', ring: 'var(--clay)' },
  shortBreak: { icon: Coffee, labelKey: 'pomodoro.modeShortBreak', ring: 'var(--olive)' },
  longBreak: { icon: Moon, labelKey: 'pomodoro.modeLongBreak', ring: 'var(--sky)' },
};

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const RING_RADIUS = 72;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

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
    start,
    pause,
    reset,
    tick,
    switchMode,
    updateSettings,
  } = useFocusStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 节拍循环 — 每秒调用一次 store.tick()，由 store 决定阶段切换
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        useFocusStore.getState().tick();
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [isRunning]);

  // 监听阶段完成事件 — 提示 + 系统通知（与现有截止提醒机制一致的轻量提示模式）
  useEffect(() => {
    function handleComplete(e: Event) {
      const detail = (e as CustomEvent).detail as { finishedMode: FocusMode; nextMode: FocusMode };
      const finishedKey = MODE_META[detail.finishedMode].labelKey;
      show(t('pomodoro.sessionDoneToast', { mode: t(finishedKey) }), 'success');

      if (useFocusStore.getState().settings.soundEnabled) {
        notifySessionDone(t('pomodoro.sessionDoneToast', { mode: t(finishedKey) }));
      }
    }
    window.addEventListener('focus-session-complete', handleComplete);
    return () => window.removeEventListener('focus-session-complete', handleComplete);
  }, [show, t]);

  const total = focusDurationFor(mode, settings);
  const progress = total > 0 ? (total - remainingSeconds) / total : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);
  const meta = MODE_META[mode];
  const ModeIcon = meta.icon;

  return (
    <div className="flex flex-col" style={{ gap: '20px' }}>
      {/* 模式切换 */}
      <div className="flex rounded-lg overflow-hidden border self-start" style={{ borderColor: 'var(--color-border)' }}>
        {(Object.keys(MODE_META) as FocusMode[]).map((m) => {
          const isActive = mode === m;
          return (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className="text-[11px] font-medium transition-all cursor-pointer flex-shrink-0"
              style={{
                padding: '6px 14px',
                whiteSpace: 'nowrap',
                lineHeight: 1.2,
                color: isActive ? 'var(--color-fill-text)' : 'var(--color-text-tertiary)',
                backgroundColor: isActive ? 'var(--color-fill)' : 'transparent',
                border: 'none',
              }}
            >
              {t(MODE_META[m].labelKey)}
            </button>
          );
        })}
      </div>

      {/* 计时圆环 */}
      <div className="flex flex-col items-center" style={{ gap: '14px' }}>
        <div className="relative" style={{ width: 180, height: 180 }}>
          <svg width={180} height={180} viewBox="0 0 180 180">
            <circle
              cx={90}
              cy={90}
              r={RING_RADIUS}
              fill="none"
              stroke="var(--color-bg-tertiary)"
              strokeWidth={10}
            />
            <motion.circle
              cx={90}
              cy={90}
              r={RING_RADIUS}
              fill="none"
              stroke={meta.ring}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 0.4, ease: 'linear' }}
              transform="rotate(-90 90 90)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center select-none" style={{ gap: '4px' }}>
            <ModeIcon size={16} style={{ color: meta.ring }} />
            <span
              className="text-[32px] font-semibold tabular-nums"
              style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.01em' }}
            >
              {formatTime(remainingSeconds)}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
              {t(meta.labelKey)}
            </span>
          </div>
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center" style={{ gap: '10px' }}>
          <ControlButton onClick={() => reset()} title={t('pomodoro.reset')}>
            <RotateCcw size={14} />
          </ControlButton>
          <button
            onClick={() => (isRunning ? pause() : start())}
            className="flex items-center justify-center transition-all cursor-pointer"
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'var(--clay)',
              color: 'var(--ivory-light)',
              border: 'none',
            }}
          >
            {isRunning ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
          </button>
          <ControlButton
            onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
            title={t('pomodoro.toggleSound')}
            active={settings.soundEnabled}
          >
            <span className="text-[10px] font-medium">{settings.soundEnabled ? '🔔' : '🔕'}</span>
          </ControlButton>
        </div>

        {/* 周期进度点 — 直观展示距离长休息还差几个专注段，未来可在习惯打卡中复用同一可视化语言 */}
        <div className="flex items-center" style={{ gap: '6px' }}>
          {Array.from({ length: settings.longBreakInterval }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: i < cycleCount ? 'var(--clay)' : 'var(--color-bg-tertiary)',
                border: i < cycleCount ? 'none' : '1px solid var(--color-border)',
              }}
            />
          ))}
          <span className="text-[10px] ml-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {t('pomodoro.totalCompleted', { count: completedWorkSessions })}
          </span>
        </div>
      </div>

      {/* 时长设置 */}
      <div className="flex flex-col" style={{ gap: '4px' }}>
        <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
          {t('pomodoro.durationSettings')}
        </span>
        <DurationRow
          label={t('pomodoro.modeWork')}
          value={settings.workMinutes}
          onChange={(v) => updateSettings({ workMinutes: v })}
        />
        <DurationRow
          label={t('pomodoro.modeShortBreak')}
          value={settings.shortBreakMinutes}
          onChange={(v) => updateSettings({ shortBreakMinutes: v })}
        />
        <DurationRow
          label={t('pomodoro.modeLongBreak')}
          value={settings.longBreakMinutes}
          onChange={(v) => updateSettings({ longBreakMinutes: v })}
        />
        <div className="flex items-center justify-between py-1.5">
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {t('pomodoro.autoStartNext')}
          </span>
          <button
            onClick={() => updateSettings({ autoStartNext: !settings.autoStartNext })}
            className="transition-all cursor-pointer"
            style={{
              width: '34px',
              height: '20px',
              borderRadius: '10px',
              backgroundColor: settings.autoStartNext ? 'var(--clay)' : 'var(--color-bg-tertiary)',
              border: '1px solid ' + (settings.autoStartNext ? 'var(--clay)' : 'var(--color-border)'),
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: settings.autoStartNext ? 16 : 2,
                width: 14,
                height: 14,
                borderRadius: '50%',
                backgroundColor: '#fff',
                transition: 'left 150ms ease',
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  onClick,
  title,
  children,
  active,
}: {
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center border transition-all cursor-pointer flex-shrink-0"
      style={{
        width: '34px',
        height: '34px',
        borderRadius: '50%',
        borderColor: active ? 'var(--clay)' : 'var(--color-border)',
        backgroundColor: 'transparent',
        color: active ? 'var(--clay)' : 'var(--color-text-secondary)',
      }}
    >
      {children}
    </button>
  );
}

function DurationRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: '0.5px solid var(--color-separator)' }}>
      <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <div className="flex items-center" style={{ gap: '6px' }}>
        <Stepper onClick={() => onChange(Math.max(1, value - 1))}>{'−'}</Stepper>
        <span
          className="text-xs tabular-nums text-center"
          style={{ width: '28px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}
        >
          {value}
        </span>
        <Stepper onClick={() => onChange(Math.min(180, value + 1))}>{'+'}</Stepper>
      </div>
    </div>
  );
}

function Stepper({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center transition-all cursor-pointer"
      style={{
        width: '20px',
        height: '20px',
        borderRadius: '4px',
        border: '1px solid var(--color-border)',
        backgroundColor: 'transparent',
        color: 'var(--color-text-secondary)',
        fontSize: '11px',
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

// 系统通知 — 失败时静默降级（如未授权），不影响主流程
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
