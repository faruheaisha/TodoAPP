import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Timer, CheckSquare, BarChart2 } from 'lucide-react';
import { useToolsPanelStore, type ToolId } from '../store/toolsStore';
import { PomodoroTool } from './tools/PomodoroTool';
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
  { id: 'pomodoro', icon: Timer,       labelKey: 'tools.pomodoro', Component: PomodoroTool },
  { id: 'habits',   icon: CheckSquare, labelKey: 'tools.habits',   Component: HabitTool },
  { id: 'insights', icon: BarChart2,   labelKey: 'tools.insights', Component: InsightsTool },
];

export default function ToolsPanel() {
  const { t } = useTranslation();
  const { isOpen, activeTool, setIsOpen, setActiveTool } = useToolsPanelStore();

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

          {/* Centering layer — flex 居中而非 transform: translate(-50%,-50%)，
              避免与 Framer Motion 自身管理的 scale transform 互相覆盖导致偏移 */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="flex overflow-hidden pointer-events-auto"
            style={{
              width: 'min(760px, 92vw)',
              height: 'min(560px, 88vh)',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '0.5px solid var(--color-border)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
            }}
          >
            {/* Left nav — 工具列表，宽度与 SettingsDrawer 对齐以统一视觉节奏 */}
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
                      }}
                      onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                      onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                    >
                      <Icon size={13} />
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

            {/* Right content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)', padding: '14px 26px' }}>
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
              <div className="flex-1 overflow-y-auto" style={{ padding: '28px 32px' }}>
                <ActiveComponent />
              </div>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </Ani