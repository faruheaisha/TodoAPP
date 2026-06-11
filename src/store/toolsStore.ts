import { create } from 'zustand';

/**
 * toolsStore — 工具面板的开关与导航状态
 *
 * 这是「工具面板」框架的最小公共状态：只负责面板开关与当前激活的工具 ID。
 * 每个工具自身的业务状态（如番茄钟的 focusStore）应保持独立，
 * 不要塞进这里——这样未来增删工具时互不影响。
 */

// 新增工具时在此追加 ID（同时在 ToolsPanel 的注册表 TOOLS 数组中登记）
export type ToolId = 'pomodoro' | 'timer' | 'calendar' | 'matrix' | 'notes' | 'habits' | 'insights';

interface ToolsPanelState {
  isOpen: boolean;
  activeTool: ToolId;
  setIsOpen: (open: boolean) => void;
  /** 打开面板并直接定位到指定工具（例如从待办行的快捷入口跳转） */
  openTool: (tool: ToolId) => void;
  setActiveTool: (tool: ToolId) => void;
}

export const useToolsPanelStore = create<ToolsPanelState>()((set) => ({
  isOpen: false,
  activeTool: 'pomodoro',

  setIsOpen: (isOpen) => set({ isOpen }),
  openTool: (tool) => set({ isOpen: true, activeTool: tool }),
  setActiveTool: (activeTool) => set({ activeTool }),
}));
