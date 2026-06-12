/**
 * tools.ts — cowork 模式白名单工具 dispatch 层（沙盒边界）
 *
 * 这是 AI 操作本应用的唯一通道。原则：
 *  1. 只暴露此处显式注册的工具，模型无法触达其他任何 store/API
 *  2. 读操作（isWrite=false）即时执行；写操作必须经聊天流中的确认卡片，
 *     用户点确认后才真正落库
 *  3. 永不暴露：settingsStore、内置音景库、数据库 schema、Tauri 配置
 *
 * 新增工具时在 TOOL_REGISTRY 登记 def + run + summarize 三件套即可。
 */
import type { ToolDef } from './client';
import { useTodoStore, type Priority } from '../../store/todoStore';
import { useSubtaskStore } from '../../store/subtaskStore';
import { useFocusStore } from '../../store/focusStore';
import { useHabitStore } from '../../store/habitStore';
import { isInTodayView, isOverdue } from '../utils';

export interface RegisteredTool {
  def: ToolDef;
  isWrite: boolean;
  /** 执行并返回给模型的 JSON 字符串结果 */
  run: (args: Record<string, unknown>) => Promise<string>;
  /** 给确认卡片/工具痕迹的一句话中文摘要 */
  summarize: (args: Record<string, unknown>, lang: 'zh' | 'en') => string;
}

const clampPriority = (p: unknown): Priority => {
  const n = Number(p);
  return (n >= 0 && n <= 3 ? Math.round(n) : 0) as Priority;
};

export const TOOL_REGISTRY: Record<string, RegisteredTool> = {
  list_todos: {
    isWrite: false,
    def: {
      name: 'list_todos',
      description: 'List the user\'s todos. scope: "today" (due today + overdue), "active" (uncompleted), "all".',
      parameters: {
        type: 'object',
        properties: {
          scope: { type: 'string', enum: ['today', 'active', 'all'] },
        },
        required: ['scope'],
      },
    },
    run: async (args) => {
      const todos = useTodoStore.getState().todos;
      const scope = String(args.scope ?? 'active');
      const list = todos.filter((t) => {
        if (scope === 'today') return isInTodayView(t);
        if (scope === 'active') return !t.completed;
        return true;
      });
      return JSON.stringify(
        list.slice(0, 50).map((t) => ({
          id: t.id, title: t.title, type: t.todoType,
          deadline: t.deadline, priority: t.priority,
          completed: t.completed, overdue: isOverdue(t),
        }))
      );
    },
    summarize: (args, lang) =>
      lang === 'zh' ? `查看任务列表（${String(args.scope)}）` : `List todos (${String(args.scope)})`,
  },

  get_stats: {
    isWrite: false,
    def: {
      name: 'get_stats',
      description: 'Get productivity stats: todo counts, today\'s due, completed pomodoro sessions, habit count.',
      parameters: { type: 'object', properties: {} },
    },
    run: async () => {
      const todos = useTodoStore.getState().todos;
      const focus = useFocusStore.getState();
      const habits = useHabitStore.getState().habits;
      return JSON.stringify({
        totalTodos: todos.length,
        activeTodos: todos.filter((t) => !t.completed).length,
        completedTodos: todos.filter((t) => t.completed).length,
        dueToday: todos.filter(isInTodayView).length,
        pomodoroSessions: focus.completedWorkSessions,
        habits: habits.length,
      });
    },
    summarize: (_args, lang) => (lang === 'zh' ? '查看效率统计' : 'Get stats'),
  },

  create_todo: {
    isWrite: true,
    def: {
      name: 'create_todo',
      description: 'Create a new todo. deadline is optional ISO local datetime "YYYY-MM-DDTHH:mm"; priority 0-3 (3=high).',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          deadline: { type: 'string' },
          priority: { type: 'number' },
        },
        required: ['title'],
      },
    },
    run: async (args) => {
      const title = String(args.title ?? '').trim().slice(0, 120);
      if (!title) return JSON.stringify({ ok: false, error: 'empty title' });
      const deadline = typeof args.deadline === 'string' && args.deadline ? args.deadline : null;
      await useTodoStore.getState().addTodo(
        title, deadline ? 'longterm' : 'quick', deadline, clampPriority(args.priority)
      );
      return JSON.stringify({ ok: true, title });
    },
    summarize: (args, lang) =>
      lang === 'zh' ? `新建任务「${String(args.title ?? '')}」` : `Create todo "${String(args.title ?? '')}"`,
  },

  add_subtasks: {
    isWrite: true,
    def: {
      name: 'add_subtasks',
      description: 'Add subtasks to an existing todo (get the todoId from list_todos first).',
      parameters: {
        type: 'object',
        properties: {
          todoId: { type: 'string' },
          subtasks: { type: 'array', items: { type: 'string' } },
        },
        required: ['todoId', 'subtasks'],
      },
    },
    run: async (args) => {
      const todo = useTodoStore.getState().todos.find((t) => t.id === args.todoId);
      if (!todo) return JSON.stringify({ ok: false, error: 'todo not found' });
      const subs = (Array.isArray(args.subtasks) ? args.subtasks : [])
        .map((s) => String(s).trim()).filter(Boolean).slice(0, 10);
      subs.forEach((s) => useSubtaskStore.getState().addSubtask(todo.id, s));
      return JSON.stringify({ ok: true, added: subs.length });
    },
    summarize: (args, lang) => {
      const n = Array.isArray(args.subtasks) ? args.subtasks.length : 0;
      return lang === 'zh' ? `为任务添加 ${n} 个子任务` : `Add ${n} subtasks`;
    },
  },

  set_priority: {
    isWrite: true,
    def: {
      name: 'set_priority',
      description: 'Set a todo\'s priority. 0=none 1=low 2=medium 3=high. Get todoId from list_todos.',
      parameters: {
        type: 'object',
        properties: {
          todoId: { type: 'string' },
          priority: { type: 'number' },
        },
        required: ['todoId', 'priority'],
      },
    },
    run: async (args) => {
      const todo = useTodoStore.getState().todos.find((t) => t.id === args.todoId);
      if (!todo) return JSON.stringify({ ok: false, error: 'todo not found' });
      await useTodoStore.getState().setPriority(todo.id, clampPriority(args.priority));
      return JSON.stringify({ ok: true });
    },
    summarize: (args, lang) =>
      lang === 'zh' ? `调整优先级为 P${3 - Number(args.priority ?? 0) + 1}` : `Set priority to ${Number(args.priority ?? 0)}`,
  },
};

export function coworkToolDefs(): ToolDef[] {
  return Object.values(TOOL_REGISTRY).map((t) => t.def);
}
