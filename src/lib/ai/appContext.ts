/**
 * appContext.ts — Asha 的系统自描述提示词
 *
 * 让模型「后台就了解 app 的所有功能」：注入功能清单 + 脱敏数据摘要，
 * 用户问"怎么用/我今天该干嘛"时无需翻文档。
 *
 * 隐私分级（沙盒原则第 3 条）：
 *  - 系统提示只含统计数字（任务总数/今日到期数等），不含任务正文
 *  - 任务标题等内容仅在 cowork 模式下、模型显式调用 list_todos 工具时返回，
 *    且该模式由用户主动选择
 */
import { useTodoStore } from '../../store/todoStore';
import { useFocusStore } from '../../store/focusStore';
import { useHabitStore } from '../../store/habitStore';
import { isInTodayView } from '../utils';
import type { ChatMode } from '../../store/chatStore';

const FEATURES_ZH = `TodoApp 功能地图：
- 任务：临时/长时两类待办，优先级 P1-P4 旗标，今日视图（逾期+今天到期），标签，子任务，重复规则，自然语言输入截止时间（如「明天下午3点开会」），智能/手动拖拽双排序模式
- 工具面板：番茄钟（任务关联/专注锁屏/时间屏保）、多并行计时器、音景白噪音（8 类真实录音混音）、日历视图、艾森豪威尔四象限、快速笔记、习惯打卡、数据洞察（完成趋势/专注柱状图/习惯热力图）
- AI：任务卡片上的 ✨ 智能拆解；与你（Asha）的 chat/cowork 对话
- 数据：JSON/CSV/PDF 导出、备份恢复，全部数据仅存本机
- 其他：深浅色主题、中英双语、全局快捷键、系统托盘、每日成就、每周报告`;

const FEATURES_EN = `TodoApp feature map:
- Tasks: quick/long-term todos, P1-P4 priority flags, Today view (overdue + due today), tags, subtasks, recurrence, natural-language deadlines ("tomorrow at 3pm"), smart/manual drag sorting
- Tools: Pomodoro (task link/focus lock/clock screen), parallel timers, soundscape white noise, calendar, Eisenhower matrix, quick notes, habits, insights charts
- AI: ✨ smart breakdown on todo cards; chat/cowork with you (Asha)
- Data: JSON/CSV/PDF export & backup, everything stays local
- Misc: light/dark theme, zh/en, global hotkey, tray, daily review, weekly report`;

function statsLine(lang: 'zh' | 'en'): string {
  const todos = useTodoStore.getState().todos;
  const focus = useFocusStore.getState();
  const habits = useHabitStore.getState().habits;
  const active = todos.filter((t) => !t.completed).length;
  const today = todos.filter(isInTodayView).length;
  return lang === 'zh'
    ? `当前状态（仅统计，无内容）：进行中任务 ${active} 个，今日到期/逾期 ${today} 个，累计完成番茄 ${focus.completedWorkSessions} 个，习惯 ${habits.length} 项。`
    : `Current state (counts only): ${active} active todos, ${today} due/overdue today, ${focus.completedWorkSessions} pomodoros done, ${habits.length} habits.`;
}

export function buildSystemPrompt(mode: ChatMode, lang: 'zh' | 'en'): string {
  const persona = lang === 'zh'
    ? `你是 Asha（阿夏），TodoApp 内置的雪豹小助手，名字源自创作者 Faruhe·Aisha。性格：安静、可靠、克制、偶尔俏皮。回答简洁，中文优先，不堆砌客套。`
    : `You are Asha, the snow-leopard assistant built into TodoApp (named after the creator Faruhe·Aisha). Calm, reliable, concise, occasionally playful.`;

  const features = lang === 'zh' ? FEATURES_ZH : FEATURES_EN;

  const modeNote = mode === 'cowork'
    ? (lang === 'zh'
        ? `当前为 cowork 模式：你可以调用提供的工具查看任务、创建任务、添加子任务、调整优先级。写操作会先经用户确认。需要任务内容时先调 list_todos。不要编造工具不存在的能力。`
        : `Cowork mode: you may use the provided tools to list/create todos, add subtasks, set priority. Writes require user confirmation. Call list_todos before referencing task content. Never invent capabilities beyond the tools.`)
    : (lang === 'zh'
        ? `当前为 chat 模式：纯对话，没有工具权限，也无法读取任务内容。涉及具体任务操作时，提示用户切换到 cowork 模式。`
        : `Chat mode: conversation only, no tools, no access to task content. Suggest switching to cowork mode for task operations.`);

  return [persona, features, statsLine(lang), modeNote].join('\n\n');
}
