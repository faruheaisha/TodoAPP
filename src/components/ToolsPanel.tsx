import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Timer, CheckSquare, BarChart2, CalendarDays, Hourglass, StickyNote, LayoutGrid, AudioLines } from 'lucide-react';
import { useToolsPanelStore, type ToolId } from '../store/toolsStore';
import { useSheet } from '../lib/responsive';
import { PomodoroTool } from './tools/PomodoroTool';
import { TimerTool } from './tools/TimerTool';
import { SoundscapeTool } from './tools/SoundscapeTool';
import { CalendarTool } from './tools/CalendarTool';
import { EisenhowerTool } from './tools/EisenhowerTool';
import { NotesTool } from './tools/NotesTool';
import { HabitTool } from './tools/HabitTool';
import { InsightsTool } from './tools/InsightsTool';

/**
 * ToolsPanel — 可扩展的工具面板框架
 *
 * 视觉与交互完全复用 SettingsDrawer 的「居中模态 + 左侧导航 + 右侧内容」结构，
 * 以保证与设置抽屉在同一套 Anthropic 视觉体系下保持一致的开关方式、间距与配色。
 *
 * 扩展方式：后续新增工具（如日历视图、习惯打卡）时，
 * 只需 1) 在 toolsStore 的 ToolId 中追加标识，2) 实现独立的工具组件，
 * 3) 在下方 TOOLS 注册表中追加一项 —— 无需改动本框架的渲染逻辑。
 */

interface ToolDef {
  id: ToolId;
  icon: ComponentType<{ size?: number }>;
  labelKey: string;
  Component: ComponentType;
}

const TOOLS: ToolDef[] = [
  { id: 'pomodoro',   icon: Timer,        labelKey: 'tools.pomodoro',   Component: PomodoroTool },
  { id: 'timer',      icon: Hourglass,    labelKey: 'tools.timer',      Component: TimerTool },
  { id: 'soundscape', icon: AudioLines,   labelKey: 'tools.soundscape', Component: SoundscapeTool },
  { id: 'calendar', icon: CalendarDays, labelKey: 'tools.calendar', Component: CalendarTool },
  { id: 'matrix',   icon: LayoutGrid,   labelKey: 'tools.matrix',   Component: EisenhowerTool },
  { id: 'notes',    icon: StickyNote,   labelKey: 'tools.notes',    Component: NotesTool },
  { id: 'habits',   icon: CheckSquare,  labelKey: 'tools.habits',   Component: HabitTool },
  { id: 'insights', icon: BarChart2,    labelKey: 'tools.insights', Component: InsightsTool },
];

export default function ToolsPanel() {
  const { t } = useTranslation();
  const { isOpen, activeTool, setIsOpen, setActiveTool } = useToolsPanelStore();
  const sheet = useSheet();

  const active = TOOLS.find((tool) => tool.id === activeTool) ?? TOOLS[0];
  const ActiveComponent = active.Component;

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

          {/* 定位层：桌面居中、手机贴底 sheet（flex 居中避免与 scale transform 冲突）*/}
          <div className={`fixed inset-0 z-50 flex justify-center pointer-events-none ${sheet.alignClass}`}>
          <motion.div
            {...sheet.motion}
            className={`${sheet.isPhone ? 'flex-col' : ''} flex overflow-hidden pointer-events-auto`}
            style={{
              ...sheet.panelStyle({ width: 'min(760px, 92vw)', height: 'min(560px, 88vh)' }),
              ...(sheet.isPhone ? { height: 'min(80dvh, 600px)' } : null),
              backgroundColor: 'var(--color-bg-secondary)',
              border: '0.5px solid var(--color-border)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {sheet.isPhone ? (
              /* 手机：顶部横向 tab 栏（横向滚动，44px 触控高） */
              <div className="flex-shrink-0 border-b flex items-center overflow-x-auto" style={{ borderColor: 'var(--color-border)', padding: '8px 12px', gap: '6px' }}>
                {TOOLS.map((tool) => {
                  const isActive = activeTool === tool.id;
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => setActiveTool(tool.id)}
                      className="flex items-center gap-1.5 flex-shrink-0 transition-all cursor-pointer rounded-lg"
                      style={{
                        height: '38px',
                        padding: '0 14px',
                        fontSize: '13px',
                        color: isActive ? 'var(--color-fill-text)' : 'var(--color-text-tertiary)',
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
            ) : (
            /* 桌面：左侧导航 — 宽度与 SettingsDrawer 对齐以统一视觉节奏 */
            <div className="flex-shrink-0 border-r flex flex-col" style={{ width: '150px', borderColor: 'var(--color-border)' }}>
              <div className="px-4 py-3 border-b flex items-center" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)', letterSpacing: 'var(--tracking-normal)' }}>
                  {t('tools.title')}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto py-1.5 px-2.5 flex flex-col" style={{ gap: '2px' }}>
                {TOOLS.map((tool) => {
                  const isActive = activeTool === tool.id;
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => setActiveTool(tool.id)}
                      className="w-full text-left flex items-center gap-2 transition-all cursor-pointer rounded-md"
                      style={{
                        height: '30px',
                        padding: '0 10px',
                        fontSize: '11px',
                        color: isActive ? 'var(--color-fill-text)' : 'var(--color-text-tertiary)',
                        backgroundColor: isActive ? 'var(--color-fill)' : 'transparent',
                        fontWeight: isActive ? 500 : 400,
                        position: 'relative',
                      }}
                      onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                      onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                    >
                      <Icon size={15} />
                      {t(tool.labelKey)}
                    </button>
                  );
                })}
              </div>
              <div className="px-4 py-2.5 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-[9px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('tools.moreSoon')}
                </span>
              </div>
            </div>
            )}

            {/* Right content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)', padding: sheet.isPhone ? '12px 16px' : '12px 24px' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {t(active.labelKey)}
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  <X size={13} />
                </button>
              </div>
              <div className="tools-scroll flex-1 overflow-y-auto" style={{ padding: sheet.isPhone ? '18px 16px' : '22px 26px' }}>
                <ActiveComponent />
              </div>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
