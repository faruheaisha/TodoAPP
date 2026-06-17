/**
 * TimerTool — 纯计时器（P2.2）
 *
 * 独立于番茄钟的正计时/倒计时，支持多个并行（参考系统 Clock app）。
 * 顶部预设 chips + 自定义分钟 → 计时器卡片列表（大号 mono 数字 +
 * 播放/暂停/重置/删除）。500ms 单一节拍驱动全部运行中的计时器。
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, X, Plus, Hourglass, TimerReset } from 'lucide-react';
import { useTimerStore, timerCurrentSec, type TimerItem } from '../../store/timerStore';
import { useToast } from '../Toast';
import { useIsTouch } from '../../lib/responsive';

const PRESETS_MIN = [1, 3, 5, 10, 25];

function fmt(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TimerTool() {
  const { t } = useTranslation();
  const { show } = useToast();
  const isTouch = useIsTouch();
  const { timers, addTimer, removeTimer, startTimer, pauseTimer, resetTimer, finishTimer } = useTimerStore();
  const [customMin, setCustomMin] = useState('');
  const [, forceTick] = useState(0);
  const sectionsReversed = useTimerStore((s) => s.sectionsReversed);
  const setSectionsReversed = useTimerStore((s) => s.setSectionsReversed);

  const anyRunning = timers.some((tm) => tm.anchorTs !== null);

  // 500ms 节拍：刷新显示 + 倒计时到点检测
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => {
      forceTick((n) => n + 1);
      const now = Date.now();
      for (const tm of useTimerStore.getState().timers) {
        if (tm.mode === 'countdown' && tm.anchorTs !== null && timerCurrentSec(tm, now) <= 0) {
          finishTimer(tm.id);
          show(t('timer.doneToast', { label: tm.label || fmt(tm.durationSec) }), 'success');
          notifyTimerDone(t('timer.doneToast', { label: tm.label || fmt(tm.durationSec) }));
        }
      }
    }, 500);
    return () => clearInterval(id);
  }, [anyRunning, finishTimer, show, t]);

  const addCustom = () => {
    const min = parseFloat(customMin);
    if (!Number.isFinite(min) || min <= 0) return;
    addTimer('countdown', Math.round(min * 60));
    setCustomMin('');
  };

  const sectionA = (
    <div className="flex flex-col" style={{ gap: '8px' }}>
      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}>
        {t('timer.newCountdown')}
      </span>
      <div className="flex items-center flex-wrap" style={{ gap: '6px' }}>
        {PRESETS_MIN.map((min) => (
          <button
            key={min}
            onClick={() => addTimer('countdown', min * 60)}
            className="cursor-pointer transition-colors"
            style={{
              height: isTouch ? '34px' : '26px', padding: '0 12px', fontSize: '11px',
              borderRadius: '13px', border: '0.5px solid var(--color-border)',
              backgroundColor: 'transparent', color: 'var(--color-text-secondary)',
              fontVariantNumeric: 'tabular-nums',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--clay)'; e.currentTarget.style.color = 'var(--clay)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
          >
            {min} {t('timer.min')}
          </button>
        ))}
        {/* 自定义分钟 */}
        <div
          className="flex items-center"
          style={{
            height: isTouch ? '34px' : '26px', borderRadius: '13px',
            border: '0.5px solid var(--color-border)', overflow: 'hidden',
          }}
        >
          <input
            type="number"
            min={1}
            value={customMin}
            onChange={(e) => setCustomMin(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addCustom(); }}
            placeholder={t('timer.custom')}
            className="text-[11px] outline-none bg-transparent text-center"
            style={{ width: '52px', border: 'none', color: 'var(--color-text-primary)' }}
          />
          <button
            onClick={addCustom}
            className="flex items-center justify-center cursor-pointer transition-colors h-full"
            style={{ width: '24px', border: 'none', backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--clay)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  );

  const sectionB = (
    <div className="flex flex-col" style={{ gap: '8px' }}>
      <div className="flex items-center" style={{ gap: '8px' }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}>
          {t('timer.newStopwatch')}
        </span>
      </div>
      <div className="flex items-center flex-wrap" style={{ gap: '6px' }}>
        <button
          onClick={() => addTimer('stopwatch', 0)}
          className="flex items-center cursor-pointer transition-colors"
          style={{
            height: isTouch ? '34px' : '26px', padding: '0 12px', fontSize: '11px', gap: '5px',
            borderRadius: '13px', border: '0.5px solid var(--color-border)',
            backgroundColor: 'transparent', color: 'var(--color-text-secondary)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--clay)'; e.currentTarget.style.color = 'var(--clay)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
        >
          <TimerReset size={11} />
          {t('timer.stopwatch')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col" style={{ gap: '16px' }}>
      {/* 可切换顺序的两个新建区 */}
      {sectionsReversed ? sectionB : sectionA}
      {sectionsReversed ? sectionA : sectionB}

      {/* 分割线 */}
      {timers.length > 0 && (
        <div style={{ height: '0.5px', background: 'var(--color-border)', margin: '4px 0' }} />
      )}

      {/* 计时器列表 */}
      {timers.length === 0 ? (
        <div className="flex flex-col items-center" style={{ padding: '26px 0', gap: '8px' }}>
          <Hourglass size={20} strokeWidth={1.5} style={{ color: 'var(--color-text-placeholder)' }} />
          <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{t('timer.empty')}</span>
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: '8px' }}>
          <AnimatePresence initial={false}>
            {timers.map((tm) => (
              <TimerCard
                key={tm.id}
                item={tm}
                onStart={() => startTimer(tm.id)}
                onPause={() => pauseTimer(tm.id)}
                onReset={() => resetTimer(tm.id)}
                onRemove={() => removeTimer(tm.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function TimerCard({ item, onStart, onPause, onReset, onRemove }: {
  item: TimerItem;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const running = item.anchorTs !== null;
  const cur = timerCurrentSec(item);
  const isDoneCountdown = item.mode === 'countdown' && cur <= 0 && !running;
  // countdown 进度（卡片底部细进度条，从满到减）
  const progress = item.mode === 'countdown' && item.durationSec > 0
    ? cur / item.durationSec
    : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="relative overflow-hidden"
      style={{
        borderRadius: '10px',
        border: '0.5px solid ' + (running ? 'var(--clay)' : 'var(--color-border)'),
        backgroundColor: 'var(--color-bg-secondary)',
        padding: '12px 14px',
      }}
    >
      <div className="flex items-center" style={{ gap: '12px' }}>
        {/* 模式标记 + 大数字 */}
        <div className="flex flex-col" style={{ gap: '2px', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: running ? 'var(--clay)' : 'var(--color-text-tertiary)' }}>
            {item.mode === 'countdown' ? t('timer.countdown') : t('timer.stopwatch')}
            {item.mode === 'countdown' && <span style={{ fontWeight: 400, marginLeft: '5px' }}>{fmt(item.durationSec)}</span>}
          </span>
          <span
            className="tabular-nums"
            style={{
              fontSize: '26px', fontWeight: 300, lineHeight: 1.1,
              fontFamily: 'var(--font-mono)',
              color: isDoneCountdown ? 'var(--clay)' : 'var(--color-text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            {fmt(cur)}
          </span>
        </div>

        {/* 操作 */}
        <div className="flex items-center" style={{ gap: '4px', flexShrink: 0 }}>
          <CardBtn onClick={onReset} title={t('timer.reset')}><RotateCcw size={12} /></CardBtn>
          <button
            onClick={running ? onPause : onStart}
            className="flex items-center justify-center cursor-pointer transition-colors"
            style={{
              width: '34px', height: '34px', borderRadius: '50%',
              backgroundColor: 'var(--clay)', color: '#fff', border: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--clay-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--clay)'; }}
          >
            {running ? <Pause size={13} /> : <Play size={13} style={{ marginLeft: '1px' }} />}
          </button>
          <CardBtn onClick={onRemove} title={t('timer.remove')}><X size={12} /></CardBtn>
        </div>
      </div>

      {/* 倒计时进度条 */}
      {item.mode === 'countdown' && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '2px', backgroundColor: 'var(--color-bg-tertiary)' }}>
          <div style={{
            height: '100%', width: `${Math.min(100, progress * 100)}%`,
            backgroundColor: 'var(--clay)',
            transition: 'width 0.5s linear',
          }} />
        </div>
      )}
    </motion.div>
  );
}

function CardBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center cursor-pointer transition-colors"
      style={{
        width: '28px', height: '28px', borderRadius: '7px',
        border: 'none', backgroundColor: 'transparent', color: 'var(--color-text-tertiary)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
    >
      {children}
    </button>
  );
}

async function notifyTimerDone(body: string) {
  try {
    const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === 'granted';
    }
    if (granted) sendNotification({ title: 'TodoApp', body });
  } catch (e) {
    console.warn('Timer notification skipped:', e);
  }
}
