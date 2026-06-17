import { useState, useRef, useEffect, type ComponentType, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Timer, CheckSquare, BarChart2, CalendarDays, Hourglass,
  StickyNote, LayoutGrid, AudioLines, Lock, Clock, ArrowUpDown,
} from 'lucide-react';
import { useToolsPanelStore, type ToolId } from '../store/toolsStore';
import { useFocusStore } from '../store/focusStore';
import { useTimerStore } from '../store/timerStore';
import { useOverlayStore } from '../store/overlayStore';
import { useSheet } from '../lib/responsive';
import { PomodoroTool } from './tools/PomodoroTool';
import { TimerTool } from './tools/TimerTool';
import { SoundscapeTool } from './tools/SoundscapeTool';
import { CalendarTool } from './tools/CalendarTool';
import { EisenhowerTool } from './tools/EisenhowerTool';
import { NotesTool } from './tools/NotesTool';
import { HabitTool } from './tools/HabitTool';
import { InsightsTool } from './tools/InsightsTool';

/* ───────────────────────────────────────────────
 * ToolDef — 单个工具注册条目
 *              id / icon / labelKey / subtitle / Component
 *              tint（icon bg 色）/ fg（icon 前景色）
 *              group（分组）
 * ─────────────────────────────────────────────── */
interface ToolDef {
  id: ToolId;
  icon: ComponentType<{ size?: number; color?: string; style?: CSSProperties }>;
  labelKey: string;
  subtitle: string;
  Component: ComponentType;
  tint: string;
  fg: string;
  group: 'productivity' | 'analytics';
  /** 是否有 running dot 指示器（番茄钟专用） */
  running?: boolean;
}

const TOOLS: ToolDef[] = [
  // ── 生产力 ──
  {
    id: 'pomodoro', icon: Timer, labelKey: 'tools.pomodoro',
    subtitle: '专注计时 · 25/5 循环', Component: PomodoroTool,
    tint: '#FBF1EC', fg: '#D97757', group: 'productivity', running: true,
  },
  {
    id: 'timer', icon: Hourglass, labelKey: 'tools.timer',
    subtitle: '倒计时 / 正计时', Component: TimerTool,
    tint: '#F0EDE8', fg: '#8C7E6E', group: 'productivity',
  },
  {
    id: 'soundscape', icon: AudioLines, labelKey: 'tools.soundscape',
    subtitle: '白噪音 · 8 种环境声', Component: SoundscapeTool,
    tint: '#EAF1EC', fg: '#5B9E78', group: 'productivity',
  },
  {
    id: 'habits', icon: CheckSquare, labelKey: 'tools.habits',
    subtitle: '每日坚持的小事', Component: HabitTool,
    tint: '#FBF1EC', fg: '#D97757', group: 'productivity',
  },
  // ── 统计分析 ──
  {
    id: 'calendar', icon: CalendarDays, labelKey: 'tools.calendar',
    subtitle: '任务的时间分布', Component: CalendarTool,
    tint: '#EAEEF5', fg: '#5E8BC0', group: 'analytics',
  },
  {
    id: 'matrix', icon: LayoutGrid, labelKey: 'tools.matrix',
    subtitle: '重要 / 紧急优先级', Component: EisenhowerTool,
    tint: '#F3ECF3', fg: '#9B6FA8', group: 'analytics',
  },
  {
    id: 'insights', icon: BarChart2, labelKey: 'tools.insights',
    subtitle: '完成趋势 · 专注时长', Component: InsightsTool,
    tint: '#EAEEF5', fg: '#5E8BC0', group: 'analytics',
  },
  {
    id: 'notes', icon: StickyNote, labelKey: 'tools.notes',
    subtitle: '速记与灵感', Component: NotesTool,
    tint: '#F0EDE8', fg: '#8C7E6E', group: 'analytics',
  },
];

interface GroupDef {
  key: 'productivity' | 'analytics';
  labelKey: string;
}

const GROUPS: GroupDef[] = [
  { key: 'productivity', labelKey: 'tools.group.productivity' },
  { key: 'analytics', labelKey: 'tools.group.analytics' },
];

/**
 * RunningDot — live-updates via useFocusStore so it catches isRunning changes.
 * Placed inside the loop so each row gets its own hook.
 */
function RunningDot({ toolId }: { toolId: ToolId }) {
  const isRunning = useFocusStore((s) => s.isRunning);
  if (toolId !== 'pomodoro' || !isRunning) return null;
  return (
    <span
      style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: 'var(--clay)',
        flex: '0 0 auto',
        animation: 'asha-pulseDot 1.8s infinite',
      }}
    />
  );
}

/** 计时器调换栏目顺序按钮（渲染在白色标题栏右侧） */
function TimerSwapBtn() {
  const { t } = useTranslation();
  const sectionsReversed = useTimerStore((s) => s.sectionsReversed);
  const setSectionsReversed = useTimerStore((s) => s.setSectionsReversed);
  return (
    <button
      onClick={() => setSectionsReversed(!sectionsReversed)}
      className="flex items-center gap-1 cursor-pointer transition-all flex-shrink-0"
      style={{
        fontSize: '11px', color: 'var(--color-text-tertiary)',
        padding: '4px 10px', borderRadius: 6,
        border: '0.5px solid var(--color-border)',
        background: 'transparent',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--clay)'; e.currentTarget.style.color = 'var(--clay)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
    >
      <ArrowUpDown size={12} />
      {t('timer.swapSections')}
    </button>
  );
}

/** 番茄钟动态副标题 — 跟随用户自定义的时长设置 */
function PomodoroSubtitle() {
  const { t } = useTranslation();
  const settings = useFocusStore((s) => s.settings);
  return (
    <>{t('pomodoro.shortWork')} · {settings.workMinutes}/{settings.shortBreakMinutes} {t('pomodoro.cycle')}</>
  );
}

/* ==============================================================
 *  ToolsPanel — 主组件
 *  左 drawer (320px) + 右 detail panel
 *  保留 AnimatePresence + useSheet 响应式架构
 * ============================================================== */
export default function ToolsPanel() {
  const { t } = useTranslation();
  const { isOpen, activeTool, setIsOpen, setActiveTool } = useToolsPanelStore();
  const isRunning = useFocusStore((s) => s.isRunning);
  const { openFocusLock, openClock } = useOverlayStore();
  const sheet = useSheet();

  // slide-in animation key: 每次切换 activeTool 时自增，
  // 让 .slide-in CSS animation 重新触发
  const [animKey, setAnimKey] = useState(0);
  const handleSetActive = (id: ToolId) => {
    if (id !== activeTool) {
      // 离开番茄钟且循环运行中 → 暂停计时
      if (activeTool === 'pomodoro' && isRunning) {
        useFocusStore.getState().pause();
        useFocusStore.getState().setPausedOnExit(true);
      }
      setActiveTool(id);
      setAnimKey((k) => k + 1);
    }
  };

  // 关闭面板时也暂停
  const prevIsOpen = useRef(isOpen);
  useEffect(() => {
    if (prevIsOpen.current && !isOpen && activeTool === 'pomodoro' && isRunning) {
      useFocusStore.getState().pause();
      useFocusStore.getState().setPausedOnExit(true);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, activeTool, isRunning]);

  const active = TOOLS.find((tool) => tool.id === activeTool) ?? TOOLS[0];
  const ActiveComponent = active.Component;

  // ── 桌面布局 ──
  const desktopPanel = (
    <div
      style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        background: 'var(--color-bg-secondary)',
      }}
    >
      {/* ── 左侧 drawer (320px) ── */}
      <aside
        style={{
          width: 320,
          flex: '0 0 320px',
          borderRight: '0.5px solid var(--color-border)',
          boxShadow: '4px 0 24px -12px rgba(40,35,30,.2)',
          padding: '14px 12px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {/* header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '2px 6px 8px',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600 }}>{t('tools.title')}</span>
          <button
            onClick={() => setIsOpen(false)}
            className="w-7 h-7 rounded flex items-center justify-center hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer"
            style={{ color: 'var(--color-text-tertiary)' }}
            title="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* grouped tool list */}
        {GROUPS.map((g, gi) => {
          const groupTools = TOOLS.filter((tool) => tool.group === g.key);
          return (
            <div key={g.key} style={{ marginTop: gi ? 10 : 0 }}>
              {/* group label */}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-tertiary)',
                  padding: '4px 10px 6px',
                }}
              >
                {t(g.labelKey)}
              </div>

              {/* tool rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {groupTools.map((tool) => {
                  const isActive = activeTool === tool.id;
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => handleSetActive(tool.id)}
                      className="cursor-pointer"
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 11,
                        padding: '9px 10px',
                        borderRadius: 10,
                        border: 'none',
                        font: 'inherit',
                        textAlign: 'left',
                        background: isActive ? 'rgba(217,119,87,.10)' : 'transparent',
                        transition: 'background .14s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.7)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }
                      }}
                    >
                      {/* tinted icon square */}
                      <span
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 9,
                          flex: '0 0 auto',
                          background: tool.tint,
                          color: tool.fg,
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <Icon size={18} />
                      </span>

                      {/* label + subtitle */}
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 13.5,
                            fontWeight: isActive ? 600 : 500,
                            color: 'var(--color-text-primary)',
                            lineHeight: 1.3,
                          }}
                        >
                          {t(tool.labelKey)}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 11.5,
                            color: 'var(--color-text-tertiary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {tool.id === 'pomodoro' ? (
                            <PomodoroSubtitle />
                          ) : (
                            tool.subtitle
                          )}
                        </span>
                      </span>

                      {/* running dot */}
                      <RunningDot toolId={tool.id} />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* footer hint */}
        <div
          style={{
            marginTop: 'auto',
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
            padding: '10px 10px 2px',
          }}
        >
          {t('tools.moreSoon')}
        </div>
      </aside>

      {/* ── 右侧 detail panel ── */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-bg-primary)',
        }}
      >
        {/* header — flex-shrink-0, always at top */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '0.5px solid var(--color-border)',
            background: 'rgba(255,255,255,.85)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          {/* tool identity: tinted icon + label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                display: 'grid',
                placeItems: 'center',
                background: active.tint,
                color: active.fg,
                flexShrink: 0,
              }}
            >
              <active.icon size={16} />
            </span>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {t(active.labelKey)}
            </span>
          </div>

          {/* right actions: pomodoro overlay toggles + swap + close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* 计时器调换栏目顺序按钮 */}
            {active.id === 'timer' && (
              <TimerSwapBtn />
            )}
            {active.id === 'pomodoro' && (
              <>
                <button
                  onClick={isRunning ? openFocusLock : undefined}
                  disabled={!isRunning}
                  title={t(isRunning ? 'pomodoro.focusLockTitle' : 'pomodoro.focusLockDisabled')}
                  className="flex items-center gap-1 transition-all cursor-pointer"
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: '0.5px solid var(--color-border)',
                    background: 'transparent',
                    fontSize: 10,
                    fontWeight: 500,
                    color: isRunning ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)',
                    opacity: isRunning ? 1 : 0.45,
                    cursor: isRunning ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Lock size={11} />
                  {t('pomodoro.focusLock')}
                </button>
                <button
                  onClick={openClock}
                  title={t('pomodoro.clockScreenTitle')}
                  className="flex items-center gap-1 transition-all cursor-pointer"
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: '0.5px solid var(--color-border)',
                    background: 'transparent',
                    fontSize: 10,
                    fontWeight: 500,
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <Clock size={11} />
                  {t('pomodoro.clockScreen')}
                </button>
              </>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded flex items-center justify-center hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* slide-in detail content — fills remaining height, scrolls if needed */}
        <div
          key={`${animKey}-${active.id}`}
          className="slide-in tools-scroll"
          style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
        >
          <div style={{ padding: '22px 26px' }}>
            <ActiveComponent />
          </div>
        </div>
      </main>
    </div>
  );

  // ── 手机：底部 sheet tab 布局 ──
  const phonePanel = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        background: 'var(--color-bg-secondary)',
      }}
    >
      {/* top tab bar */}
      <div
        className="flex-shrink-0 border-b flex items-center overflow-x-auto"
        style={{ borderColor: 'var(--color-border)', padding: '8px 12px', gap: 6 }}
      >
        {TOOLS.map((tool) => {
          const isActive = activeTool === tool.id;
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => handleSetActive(tool.id)}
              className="flex items-center gap-1.5 flex-shrink-0 transition-all cursor-pointer rounded-lg"
              style={{
                height: 38,
                padding: '0 14px',
                fontSize: 13,
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                backgroundColor: isActive ? 'var(--color-fill)' : 'var(--color-bg-tertiary)',
                fontWeight: isActive ? 500 : 400,
                border: 'none',
              }}
            >
              <Icon size={15} />
              {t(tool.labelKey)}
            </button>
          );
        })}
      </div>

      {/* detail content */}
      <div className="tools-scroll flex-1 overflow-y-auto" style={{ padding: '18px 16px' }}>
        <div key={`${animKey}-${active.id}`} className="slide-in">
          <ActiveComponent />
        </div>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div
            className={`fixed inset-0 z-50 flex justify-center pointer-events-none ${sheet.alignClass}`}
          >
            <motion.div
              {...sheet.motion}
              className={`${sheet.isPhone ? 'flex-col' : ''} flex overflow-hidden pointer-events-auto`}
              style={{
                ...sheet.panelStyle({
                  width: 'min(840px, 92vw)',
                  height: 'min(620px, 88vh)',
                }),
                ...(sheet.isPhone ? { height: 'min(80dvh, 600px)' } : null),
                backgroundColor: 'var(--color-bg-secondary)',
                border: '0.5px solid var(--color-border)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {sheet.isPhone ? phonePanel : desktopPanel}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
