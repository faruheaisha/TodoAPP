import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Timer } from 'lucide-react';
import { useToolsPanelStore, type ToolId } from '../store/toolsStore';
import { PomodoroTool } from './tools/PomodoroTool';

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
  { id: 'pomodoro', icon: Timer, labelKey: 'tools.pomodoro', Component: PomodoroTool },
  // 占位示例 — 后续接入时取消注释并实现对应组件：
  // { id: 'calendar', icon: CalendarDays, labelKey: 'tools.calendar', Component: CalendarTool },
  // { id: 'habits',   icon: ListChecks,   labelKey: 'tools.habits',   Component: HabitsTool },
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

          {/* Tools modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed z-50 flex overflow-hidden"
            style={{
              width: 'min(640px, 92vw)',
              maxHeight: '86vh',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '0.5px solid var(--color-border)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Left nav — 工具列表，宽度与 SettingsDrawer 对齐以统一视觉节奏 */}
            <div className="flex-shrink-0 border-r flex flex-col" style={{ width: '150px', borderColor: 'var(--color-border)' }}>
              <div className="px-4 py-3 border-b flex items-center" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)', letterSpacing: 'var(--tracking-normal)' }}>
                  {t('tools.title')}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {TOOLS.map((tool) => {
                  const isActive = activeTool === tool.id;
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => setActiveTool(tool.id)}
                      className="w-full text-left flex items-center gap-2 transition-all cursor-pointer"
                      style={{
                        height: '30px',
                        padding: '0 10px',
                        fontSize: '11px',
                        color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                        backgroundColor: isActive ? 'var(--color-bg-tertiary)' : 'transparent',
                        borderLeft: isActive ? '2px solid var(--clay)' : '2px solid transparent',
                        fontWeight: isActive ? 500 : 400,
                      }}
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
              <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
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
              <div className="flex-1 overflow-y-auto" style={{ padding: '16px' }}>
                <ActiveComponent />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
