/**
 * tools.ts — cowork 模式白名单工具 dispatch 层（沙盒边界）
 *
 * 这是 AI 操作本应用的唯一通道。原则：
 *  1. 只暴露此处显式注册的工具，模型无法触达其他任何 store/API
 *  2. 读操作（read 级）即时执行；写操作经聊天流中的确认卡片，
 *     用户点确认后才真正落库。alwaysConfirm 工具无论权限层级都必弹确认
 *     （导出 / 云备份 / 音乐下载等对外或搬运数据的操作）
 *  3. 权限边界（用户可调）：
 *     - 可操作「自由区」：todos/subtasks/tags/habits/notes/music/recurrence、
 *       外观偏好(appearance)、日程偏好(schedule)、导航(navigation)、
 *       数据搬运(backup)、用量日志只读(logs)
 *     - 🔒 永不暴露（无任何工具映射）：API Key / 供应商配置、云备份账号密码、
 *       全局快捷键、权限系统自身、内置音景清单、数据库 schema、Tauri 配置
 *
 * 新增工具时在 TOOL_REGISTRY 登记 def + run + summarize 三件套即可。
 */
import type { ToolDef } from './client';
import { usePermissionStore, type ToolPermission } from '../../store/permissionStore';
import { useTodoStore, type Priority, type TodoType } from '../../store/todoStore';
import { useSubtaskStore } from '../../store/subtaskStore';
import { useTagStore } from '../../store/tagStore';
import { useNotesStore } from '../../store/notesStore';
import { useFocusStore } from '../../store/focusStore';
import { useHabitStore, calcStreak, calcCompletionRate, calcWeeklyProgress, toDateKey } from '../../store/habitStore';
import { useMusicLibraryStore } from '../../store/musicLibraryStore';
import { useRecurrenceStore } from '../../store/recurrenceStore';
import { useToolsPanelStore, type ToolId } from '../../store/toolsStore';
import { useCompletionStore } from '../../store/completionStore';
// 选择性暴露的设置项（仅 appearance/schedule，绝不含凭据/密钥/快捷键 setter）
import { useSettingsStore } from '../../store/settingsStore';
import { useOverlayStore } from '../../store/overlayStore';
import { useUsageStore, summarize as summarizeUsage } from '../../store/usageStore';
import { isInTodayView, isOverdue, localDateKey } from '../utils';
import { classifyTodo } from './workflows';

export interface RegisteredTool {
  def: ToolDef;
  /** @deprecated Use permissions.minTier >= 2 */
  isWrite: boolean;
  permissions: ToolPermission;
  /** 无论权限层级都强制弹确认卡（对外发布 / 数据搬运 / 联网下载等） */
  alwaysConfirm?: boolean;
  /** 执行并返回给模型的 JSON 字符串结果 */
  run: (args: Record<string, unknown>) => Promise<string>;
  /** 给确认卡片/工具痕迹的一句话中文摘要 */
  summarize: (args: Record<string, unknown>, lang: 'zh' | 'en') => string;
}

/** 判断某模型是否有权执行某工具（基于 store 中持久化的权限配置） */
export function canExecuteTool(compositeKey: string, tp: ToolPermission): boolean {
  return usePermissionStore.getState().canExecute(compositeKey, tp);
}

/**
 * 判断某工具是否需要弹确认卡。
 *  - read 级工具（minTier<=1）从不弹
 *  - alwaysConfirm 工具：只要有执行权限就必弹（不受 trusted/admin 影响）
 *  - 普通写工具：有效层级 <= suggest(2) 才弹，trusted+ 静默执行
 */
export function requiresConfirm(compositeKey: string, tp: ToolPermission, alwaysConfirm?: boolean): boolean {
  if (tp.minTier <= 1) return false;
  if (alwaysConfirm) {
    return usePermissionStore.getState().canExecute(compositeKey, tp);
  }
  const eff = usePermissionStore.getState().getEffectiveTier(compositeKey, tp.domain);
  return eff <= 2;
}

const clampPriority = (p: unknown): Priority => {
  const n = Number(p);
  return (n >= 0 && n <= 3 ? Math.round(n) : 0) as Priority;
};

export const TOOL_REGISTRY: Record<string, RegisteredTool> = {
  list_todos: {
    isWrite: false,
    permissions: { domain: 'todos', minTier: 1 },
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
    permissions: { domain: 'stats', minTier: 1 },
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
    permissions: { domain: 'todos', minTier: 2 },
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
    permissions: { domain: 'subtasks', minTier: 2 },
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
    permissions: { domain: 'todos', minTier: 2 },
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

  // ── Expanded Todo Tools ──────────────────────────────────────────

  get_todo: {
    isWrite: false,
    permissions: { domain: 'todos', minTier: 1 },
    def: {
      name: 'get_todo',
      description: 'Get full todo details including subtasks, tags, note, recurrence, completion time. Requires todoId from list_todos.',
      parameters: { type: 'object', properties: { todoId: { type: 'string' } }, required: ['todoId'] },
    },
    run: async (args) => {
      const todo = useTodoStore.getState().todos.find((t) => t.id === args.todoId);
      if (!todo) return JSON.stringify({ ok: false, error: 'todo not found' });
      return JSON.stringify({
        ...todo,
        subtasks: useSubtaskStore.getState().getSubtasks(todo.id),
        tags: useTagStore.getState().getTodoTags(todo.id),
        note: useNotesStore.getState().todoNotes[todo.id] || '',
        completionTime: useCompletionStore.getState().getCompletionTime(todo.id),
        recurrence: useRecurrenceStore.getState().getRule(todo.id),
      });
    },
    summarize: (_args, lang) => (lang === 'zh' ? '查看任务详情' : 'View todo details'),
  },

  update_todo: {
    isWrite: true,
    permissions: { domain: 'todos', minTier: 2 },
    def: {
      name: 'update_todo',
      description: 'Update a todo\'s title, deadline (ISO "YYYY-MM-DDTHH:mm" or null to clear), priority (0-3), or type ("quick"/"longterm"). Only include fields to change.',
      parameters: {
        type: 'object',
        properties: {
          todoId: { type: 'string' },
          title: { type: 'string' },
          deadline: { type: 'string' },
          priority: { type: 'number' },
          todoType: { type: 'string', enum: ['quick', 'longterm'] },
        },
        required: ['todoId'],
      },
    },
    run: async (args) => {
      const todo = useTodoStore.getState().todos.find((t) => t.id === args.todoId);
      if (!todo) return JSON.stringify({ ok: false, error: 'todo not found' });
      const patch: Partial<Record<string, unknown>> = {};
      if (typeof args.title === 'string' && args.title.trim()) patch.title = args.title.trim().slice(0, 120);
      if (args.deadline !== undefined) patch.deadline = typeof args.deadline === 'string' && args.deadline ? args.deadline : null;
      if (args.priority !== undefined) patch.priority = clampPriority(args.priority);
      if (args.todoType !== undefined) patch.todoType = args.todoType as TodoType;
      if (Object.keys(patch).length === 0) return JSON.stringify({ ok: false, error: 'no fields to update' });
      await useTodoStore.getState().updateTodo(todo.id, patch);
      return JSON.stringify({ ok: true });
    },
    summarize: (args, lang) => (lang === 'zh' ? '更新任务' : 'Update todo'),
  },

  delete_todo: {
    isWrite: true,
    permissions: { domain: 'todos', minTier: 2 },
    def: {
      name: 'delete_todo',
      description: 'Delete a todo permanently (also removes subtasks, tags, notes, recurrence). Get todoId from list_todos first.',
      parameters: { type: 'object', properties: { todoId: { type: 'string' } }, required: ['todoId'] },
    },
    run: async (args) => {
      if (!useTodoStore.getState().todos.some((t) => t.id === args.todoId))
        return JSON.stringify({ ok: false, error: 'todo not found' });
      await useTodoStore.getState().deleteTodo(String(args.todoId));
      return JSON.stringify({ ok: true });
    },
    summarize: (_args, lang) => (lang === 'zh' ? '删除任务' : 'Delete todo'),
  },

  toggle_todo: {
    isWrite: true,
    permissions: { domain: 'todos', minTier: 2 },
    def: {
      name: 'toggle_todo',
      description: 'Toggle a todo completed/uncompleted. Handles recurrence (auto-creates next instance).',
      parameters: { type: 'object', properties: { todoId: { type: 'string' } }, required: ['todoId'] },
    },
    run: async (args) => {
      if (!useTodoStore.getState().todos.some((t) => t.id === args.todoId))
        return JSON.stringify({ ok: false, error: 'todo not found' });
      await useTodoStore.getState().toggleComplete(String(args.todoId));
      return JSON.stringify({ ok: true });
    },
    summarize: (_args, lang) => (lang === 'zh' ? '切换任务完成状态' : 'Toggle todo completion'),
  },

  // ── Subtask Tools ────────────────────────────────────────────────

  list_subtasks: {
    isWrite: false,
    permissions: { domain: 'subtasks', minTier: 1 },
    def: {
      name: 'list_subtasks',
      description: 'List all subtasks for a todo.',
      parameters: { type: 'object', properties: { todoId: { type: 'string' } }, required: ['todoId'] },
    },
    run: async (args) => {
      const subs = useSubtaskStore.getState().getSubtasks(String(args.todoId));
      return JSON.stringify(subs.slice(0, 50));
    },
    summarize: (_args, lang) => (lang === 'zh' ? '查看子任务' : 'List subtasks'),
  },

  toggle_subtask: {
    isWrite: true,
    permissions: { domain: 'subtasks', minTier: 2 },
    def: {
      name: 'toggle_subtask',
      description: 'Toggle a subtask completed/uncompleted.',
      parameters: {
        type: 'object',
        properties: { todoId: { type: 'string' }, subtaskId: { type: 'string' } },
        required: ['todoId', 'subtaskId'],
      },
    },
    run: async (args) => {
      useSubtaskStore.getState().toggleSubtask(String(args.todoId), String(args.subtaskId));
      return JSON.stringify({ ok: true });
    },
    summarize: (_args, lang) => (lang === 'zh' ? '切换子任务状态' : 'Toggle subtask'),
  },

  delete_subtask: {
    isWrite: true,
    permissions: { domain: 'subtasks', minTier: 2 },
    def: {
      name: 'delete_subtask',
      description: 'Delete a subtask permanently.',
      parameters: {
        type: 'object',
        properties: { todoId: { type: 'string' }, subtaskId: { type: 'string' } },
        required: ['todoId', 'subtaskId'],
      },
    },
    run: async (args) => {
      useSubtaskStore.getState().deleteSubtask(String(args.todoId), String(args.subtaskId));
      return JSON.stringify({ ok: true });
    },
    summarize: (_args, lang) => (lang === 'zh' ? '删除子任务' : 'Delete subtask'),
  },

  // ── Tag Tools ────────────────────────────────────────────────────

  list_tags: {
    isWrite: false,
    permissions: { domain: 'tags', minTier: 1 },
    def: {
      name: 'list_tags',
      description: 'List all tags with their colors and usage counts.',
      parameters: { type: 'object', properties: {} },
    },
    run: async () => {
      const { tags, todoTags } = useTagStore.getState();
      return JSON.stringify(
        tags.slice(0, 50).map((t) => ({
          id: t.id, name: t.name, color: t.color,
          usageCount: Object.values(todoTags).filter((ids) => ids.includes(t.id)).length,
        }))
      );
    },
    summarize: (_args, lang) => (lang === 'zh' ? '查看标签' : 'List tags'),
  },

  create_tag: {
    isWrite: true,
    permissions: { domain: 'tags', minTier: 2 },
    def: {
      name: 'create_tag',
      description: 'Create a new tag. color is optional hex (default: clay).',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' }, color: { type: 'string' } },
        required: ['name'],
      },
    },
    run: async (args) => {
      const name = String(args.name ?? '').trim();
      if (!name) return JSON.stringify({ ok: false, error: 'empty name' });
      const color = typeof args.color === 'string' ? args.color : 'clay';
      const tag = useTagStore.getState().addTag(name, color);
      return JSON.stringify({ ok: true, id: tag.id, name: tag.name, color: tag.color });
    },
    summarize: (args, lang) => (lang === 'zh' ? `创建标签「${String(args.name ?? '')}」` : `Create tag "${String(args.name ?? '')}"`),
  },

  add_tags_to_todo: {
    isWrite: true,
    permissions: { domain: 'tags', minTier: 2 },
    def: {
      name: 'add_tags_to_todo',
      description: 'Add tags to a todo. Get tagIds from list_tags, todoId from list_todos.',
      parameters: {
        type: 'object',
        properties: { todoId: { type: 'string' }, tagIds: { type: 'array', items: { type: 'string' } } },
        required: ['todoId', 'tagIds'],
      },
    },
    run: async (args) => {
      const todoId = String(args.todoId);
      const ids = Array.isArray(args.tagIds) ? args.tagIds.map(String) : [];
      if (!useTodoStore.getState().todos.some((t) => t.id === todoId))
        return JSON.stringify({ ok: false, error: 'todo not found' });
      const { addTagToTodo } = useTagStore.getState();
      ids.forEach((id) => addTagToTodo(todoId, id));
      return JSON.stringify({ ok: true, added: ids.length });
    },
    summarize: (args, lang) => {
      const n = Array.isArray(args.tagIds) ? args.tagIds.length : 0;
      return lang === 'zh' ? `为任务添加 ${n} 个标签` : `Add ${n} tags to todo`;
    },
  },

  remove_tags_from_todo: {
    isWrite: true,
    permissions: { domain: 'tags', minTier: 2 },
    def: {
      name: 'remove_tags_from_todo',
      description: 'Remove tags from a todo.',
      parameters: {
        type: 'object',
        properties: { todoId: { type: 'string' }, tagIds: { type: 'array', items: { type: 'string' } } },
        required: ['todoId', 'tagIds'],
      },
    },
    run: async (args) => {
      const todoId = String(args.todoId);
      const ids = Array.isArray(args.tagIds) ? args.tagIds.map(String) : [];
      const { removeTagFromTodo } = useTagStore.getState();
      ids.forEach((id) => removeTagFromTodo(todoId, id));
      return JSON.stringify({ ok: true, removed: ids.length });
    },
    summarize: (args, lang) => {
      const n = Array.isArray(args.tagIds) ? args.tagIds.length : 0;
      return lang === 'zh' ? `从任务移除 ${n} 个标签` : `Remove ${n} tags from todo`;
    },
  },

  // ── Habit Tools ──────────────────────────────────────────────────

  list_habits: {
    isWrite: false,
    permissions: { domain: 'habits', minTier: 1 },
    def: {
      name: 'list_habits',
      description: 'List all habits with current streaks, completion rates, and weekly progress.',
      parameters: { type: 'object', properties: {} },
    },
    run: async () => {
      const habits = useHabitStore.getState().habits;
      return JSON.stringify(
        habits.slice(0, 50).map((h) => ({
          id: h.id, name: h.name, color: h.color,
          frequency: h.frequency, weeklyTarget: h.weeklyTarget,
          streak: calcStreak(new Set(h.checkIns)),
          completionRate: calcCompletionRate(h.checkIns),
          weeklyProgress: calcWeeklyProgress(h.checkIns),
          totalCheckIns: h.checkIns.length,
        }))
      );
    },
    summarize: (_args, lang) => (lang === 'zh' ? '查看习惯列表' : 'List habits'),
  },

  check_in_habit: {
    isWrite: true,
    permissions: { domain: 'habits', minTier: 2 },
    def: {
      name: 'check_in_habit',
      description: 'Check in / mark a habit done for a specific date. date is YYYY-MM-DD, defaults to today if omitted. Toggles (if already checked in, unchecks).',
      parameters: {
        type: 'object',
        properties: {
          habitId: { type: 'string' },
          date: { type: 'string' },
        },
        required: ['habitId'],
      },
    },
    run: async (args) => {
      const habitId = String(args.habitId);
      const date = typeof args.date === 'string' && args.date ? args.date : toDateKey(new Date());
      const habit = useHabitStore.getState().habits.find((h) => h.id === habitId);
      if (!habit) return JSON.stringify({ ok: false, error: 'habit not found' });
      const wasAlready = habit.checkIns.includes(date);
      useHabitStore.getState().toggleCheckIn(habitId, date);
      return JSON.stringify({ ok: true, date, wasCheckedIn: wasAlready, nowCheckedIn: !wasAlready });
    },
    summarize: (args, lang) => {
      const date = typeof args.date === 'string' && args.date ? args.date : 'today';
      return lang === 'zh' ? `习惯打卡（${date}）` : `Check in habit (${date})`;
    },
  },

  create_habit: {
    isWrite: true,
    permissions: { domain: 'habits', minTier: 2 },
    def: {
      name: 'create_habit',
      description: 'Create a new habit. frequency: "daily" (default) or "flexible". weeklyTarget defaults to 3.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          color: { type: 'string', enum: ['clay', 'olive', 'sky', 'fig', 'amber', 'teal', 'purple', 'neutral'] },
          frequency: { type: 'string', enum: ['daily', 'flexible'] },
          weeklyTarget: { type: 'number' },
        },
        required: ['name'],
      },
    },
    run: async (args) => {
      const name = String(args.name ?? '').trim();
      if (!name) return JSON.stringify({ ok: false, error: 'empty name' });
      const color = typeof args.color === 'string' ? args.color : 'clay';
      const frequency = args.frequency === 'flexible' ? 'flexible' as const : 'daily' as const;
      const target = typeof args.weeklyTarget === 'number' ? Math.max(1, Math.min(7, Math.round(args.weeklyTarget))) : 3;
      useHabitStore.getState().addHabit(name, color as never, '', '', frequency, target);
      return JSON.stringify({ ok: true, name });
    },
    summarize: (args, lang) => (lang === 'zh' ? `创建习惯「${String(args.name ?? '')}」` : `Create habit "${String(args.name ?? '')}"`),
  },

  remove_habit: {
    isWrite: true,
    permissions: { domain: 'habits', minTier: 2 },
    def: {
      name: 'remove_habit',
      description: 'Delete a habit permanently.',
      parameters: { type: 'object', properties: { habitId: { type: 'string' } }, required: ['habitId'] },
    },
    run: async (args) => {
      if (!useHabitStore.getState().habits.some((h) => h.id === args.habitId))
        return JSON.stringify({ ok: false, error: 'habit not found' });
      useHabitStore.getState().removeHabit(String(args.habitId));
      return JSON.stringify({ ok: true });
    },
    summarize: (_args, lang) => (lang === 'zh' ? '删除习惯' : 'Remove habit'),
  },

  get_habit_stats: {
    isWrite: false,
    permissions: { domain: 'habits', minTier: 1 },
    def: {
      name: 'get_habit_stats',
      description: 'Get detailed statistics for a habit: streak, 30-day completion rate, weekly progress.',
      parameters: { type: 'object', properties: { habitId: { type: 'string' } }, required: ['habitId'] },
    },
    run: async (args) => {
      const habit = useHabitStore.getState().habits.find((h) => h.id === args.habitId);
      if (!habit) return JSON.stringify({ ok: false, error: 'habit not found' });
      return JSON.stringify({
        id: habit.id, name: habit.name,
        streak: calcStreak(new Set(habit.checkIns)),
        completionRate: calcCompletionRate(habit.checkIns),
        weeklyProgress: calcWeeklyProgress(habit.checkIns),
        weeklyTarget: habit.weeklyTarget,
        totalCheckIns: habit.checkIns.length,
      });
    },
    summarize: (_args, lang) => (lang === 'zh' ? '查看习惯统计' : 'Habit statistics'),
  },

  // ── Notes Tools ──────────────────────────────────────────────────

  get_scratchpad: {
    isWrite: false,
    permissions: { domain: 'notes', minTier: 1 },
    def: {
      name: 'get_scratchpad',
      description: 'Read the global scratchpad (quick notes area).',
      parameters: { type: 'object', properties: {} },
    },
    run: async () => {
      const text = useNotesStore.getState().scratchpad;
      return JSON.stringify({ text: text || '' });
    },
    summarize: (_args, lang) => (lang === 'zh' ? '查看随手记' : 'Read scratchpad'),
  },

  set_scratchpad: {
    isWrite: true,
    permissions: { domain: 'notes', minTier: 2 },
    def: {
      name: 'set_scratchpad',
      description: 'Write to the global scratchpad (quick notes area).',
      parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    },
    run: async (args) => {
      useNotesStore.getState().setScratchpad(String(args.text ?? ''));
      return JSON.stringify({ ok: true });
    },
    summarize: (_args, lang) => (lang === 'zh' ? '更新随手记' : 'Update scratchpad'),
  },

  get_todo_note: {
    isWrite: false,
    permissions: { domain: 'notes', minTier: 1 },
    def: {
      name: 'get_todo_note',
      description: 'Read the note attached to a specific todo.',
      parameters: { type: 'object', properties: { todoId: { type: 'string' } }, required: ['todoId'] },
    },
    run: async (args) => {
      const text = useNotesStore.getState().todoNotes[String(args.todoId)] || '';
      return JSON.stringify({ text });
    },
    summarize: (_args, lang) => (lang === 'zh' ? '查看任务笔记' : 'Read todo note'),
  },

  set_todo_note: {
    isWrite: true,
    permissions: { domain: 'notes', minTier: 2 },
    def: {
      name: 'set_todo_note',
      description: 'Write a note to a specific todo. Pass empty text to clear the note.',
      parameters: {
        type: 'object',
        properties: { todoId: { type: 'string' }, text: { type: 'string' } },
        required: ['todoId', 'text'],
      },
    },
    run: async (args) => {
      useNotesStore.getState().setTodoNote(String(args.todoId), String(args.text ?? ''));
      return JSON.stringify({ ok: true });
    },
    summarize: (_args, lang) => (lang === 'zh' ? '更新任务笔记' : 'Update todo note'),
  },

  // ── Music Library Tools ──────────────────────────────────────────

  list_tracks: {
    isWrite: false,
    permissions: { domain: 'music', minTier: 1 },
    def: {
      name: 'list_tracks',
      description: 'List personal music library tracks. Optional categoryId to filter by tag.',
      parameters: {
        type: 'object',
        properties: { categoryId: { type: 'string' } },
      },
    },
    run: async (args) => {
      const { tracks } = useMusicLibraryStore.getState();
      const catId = typeof args.categoryId === 'string' ? args.categoryId : '';
      let filtered = tracks;
      if (catId) filtered = filtered.filter((t) => t.tags.includes(catId));
      return JSON.stringify(
        filtered.slice(0, 50).map((t) => ({ id: t.id, name: t.name, tags: t.tags, importedAt: t.importedAt }))
      );
    },
    summarize: (args, lang) => {
      const cat = typeof args.categoryId === 'string' ? ` (${args.categoryId})` : '';
      return lang === 'zh' ? `查看音乐曲目${cat}` : `List tracks${cat}`;
    },
  },

  list_categories: {
    isWrite: false,
    permissions: { domain: 'music', minTier: 1 },
    def: {
      name: 'list_categories',
      description: 'List music library categories with track counts.',
      parameters: { type: 'object', properties: {} },
    },
    run: async () => {
      const { categories, tracks } = useMusicLibraryStore.getState();
      return JSON.stringify(
        categories.slice(0, 50).map((c) => ({
          id: c.id, name: c.name, trackCount: tracks.filter((t) => t.tags.includes(c.id)).length,
        }))
      );
    },
    summarize: (_args, lang) => (lang === 'zh' ? '查看音乐分类' : 'List music categories'),
  },

  download_track: {
    isWrite: true,
    permissions: { domain: 'music', minTier: 2 },
    alwaysConfirm: true,
    def: {
      name: 'download_track',
      description: 'Download an audio track from an HTTPS URL the user explicitly provides, saving it into the personal music library. Only call when the user gives a direct audio link (mp3/wav/ogg/flac/m4a/aac/wma/opus). url: the https link; name: filename with audio extension; categoryId optional.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          name: { type: 'string' },
          categoryId: { type: 'string' },
        },
        required: ['url', 'name'],
      },
    },
    run: async (args) => {
      const url = String(args.url ?? '').trim();
      const name = String(args.name ?? '').trim();
      if (!/^https:\/\//i.test(url)) return JSON.stringify({ ok: false, error: 'only https:// urls allowed' });
      if (!name) return JSON.stringify({ ok: false, error: 'missing name' });
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const destPath = await invoke<string>('download_audio', { url, name });
        const catId = typeof args.categoryId === 'string' ? args.categoryId : '';
        const track = {
          id: 'ut_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          name,
          filePath: destPath,
          tags: catId ? [catId] : [],
          importedAt: Date.now(),
        };
        useMusicLibraryStore.getState().addTrack(track);
        return JSON.stringify({ ok: true, id: track.id, name });
      } catch (e) {
        return JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    },
    summarize: (args, lang) =>
      lang === 'zh' ? `下载音乐「${String(args.name ?? '')}」到音乐库` : `Download track "${String(args.name ?? '')}"`,
  },

  remove_track: {
    isWrite: true,
    permissions: { domain: 'music', minTier: 2 },
    def: {
      name: 'remove_track',
      description: 'Remove a track from the music library (removes the entry, not the file on disk).',
      parameters: { type: 'object', properties: { trackId: { type: 'string' } }, required: ['trackId'] },
    },
    run: async (args) => {
      const id = String(args.trackId);
      if (!useMusicLibraryStore.getState().tracks.some((t) => t.id === id))
        return JSON.stringify({ ok: false, error: 'track not found' });
      useMusicLibraryStore.getState().removeTrack(id);
      return JSON.stringify({ ok: true });
    },
    summarize: (_args, lang) => (lang === 'zh' ? '删除音乐曲目' : 'Remove track'),
  },

  add_category: {
    isWrite: true,
    permissions: { domain: 'music', minTier: 2 },
    def: {
      name: 'add_category',
      description: 'Create a new music library category.',
      parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    },
    run: async (args) => {
      const name = String(args.name ?? '').trim();
      if (!name) return JSON.stringify({ ok: false, error: 'empty name' });
      useMusicLibraryStore.getState().addCategory(name);
      return JSON.stringify({ ok: true, name });
    },
    summarize: (args, lang) => (lang === 'zh' ? `添加音乐分类「${String(args.name ?? '')}」` : `Add category "${String(args.name ?? '')}"`),
  },

  remove_category: {
    isWrite: true,
    permissions: { domain: 'music', minTier: 2 },
    def: {
      name: 'remove_category',
      description: 'Delete a music library category (also removes it from all tracks\' tags).',
      parameters: { type: 'object', properties: { categoryId: { type: 'string' } }, required: ['categoryId'] },
    },
    run: async (args) => {
      const id = String(args.categoryId);
      if (!useMusicLibraryStore.getState().categories.some((c) => c.id === id))
        return JSON.stringify({ ok: false, error: 'category not found' });
      useMusicLibraryStore.getState().removeCategory(id);
      return JSON.stringify({ ok: true });
    },
    summarize: (_args, lang) => (lang === 'zh' ? '删除音乐分类' : 'Remove category'),
  },

  // ── Recurrence Tools ─────────────────────────────────────────────

  get_recurrence: {
    isWrite: false,
    permissions: { domain: 'recurrence', minTier: 1 },
    def: {
      name: 'get_recurrence',
      description: 'Get the recurrence rule for a todo, if any.',
      parameters: { type: 'object', properties: { todoId: { type: 'string' } }, required: ['todoId'] },
    },
    run: async (args) => {
      const rule = useRecurrenceStore.getState().getRule(String(args.todoId));
      return JSON.stringify(rule ? { type: rule.type } : { type: null });
    },
    summarize: (_args, lang) => (lang === 'zh' ? '查看重复规则' : 'Get recurrence rule'),
  },

  set_recurrence: {
    isWrite: true,
    permissions: { domain: 'recurrence', minTier: 2 },
    def: {
      name: 'set_recurrence',
      description: 'Set a recurrence rule on a todo. type: daily, weekdays, weekly, monthly.',
      parameters: {
        type: 'object',
        properties: {
          todoId: { type: 'string' },
          type: { type: 'string', enum: ['daily', 'weekdays', 'weekly', 'monthly'] },
        },
        required: ['todoId', 'type'],
      },
    },
    run: async (args) => {
      const todoId = String(args.todoId);
      const type = String(args.type) as 'daily' | 'weekdays' | 'weekly' | 'monthly';
      if (!['daily', 'weekdays', 'weekly', 'monthly'].includes(type))
        return JSON.stringify({ ok: false, error: 'invalid type' });
      if (!useTodoStore.getState().todos.some((t) => t.id === todoId))
        return JSON.stringify({ ok: false, error: 'todo not found' });
      useRecurrenceStore.getState().setRule(todoId, { type });
      return JSON.stringify({ ok: true, type });
    },
    summarize: (args, lang) => (lang === 'zh' ? `设置重复规则：${String(args.type)}` : `Set recurrence: ${String(args.type)}`),
  },

  remove_recurrence: {
    isWrite: true,
    permissions: { domain: 'recurrence', minTier: 2 },
    def: {
      name: 'remove_recurrence',
      description: 'Remove the recurrence rule from a todo.',
      parameters: { type: 'object', properties: { todoId: { type: 'string' } }, required: ['todoId'] },
    },
    run: async (args) => {
      useRecurrenceStore.getState().removeRule(String(args.todoId));
      return JSON.stringify({ ok: true });
    },
    summarize: (_args, lang) => (lang === 'zh' ? '移除重复规则' : 'Remove recurrence rule'),
  },

  // ── Navigation Tool ──────────────────────────────────────────────

  open_tool: {
    isWrite: false,
    permissions: { domain: 'navigation', minTier: 1 },
    def: {
      name: 'open_tool',
      description: 'Open a specific tool panel for the user: pomodoro, timer, soundscape, calendar, matrix, notes, habits, insights.',
      parameters: {
        type: 'object',
        properties: {
          toolId: { type: 'string', enum: ['pomodoro', 'timer', 'soundscape', 'calendar', 'matrix', 'notes', 'habits', 'insights'] },
        },
        required: ['toolId'],
      },
    },
    run: async (args) => {
      const toolId = String(args.toolId) as ToolId;
      useToolsPanelStore.getState().openTool(toolId);
      return JSON.stringify({ ok: true, opened: toolId });
    },
    summarize: (args, lang) => (lang === 'zh' ? `打开工具：${String(args.toolId)}` : `Open tool: ${String(args.toolId)}`),
  },

  open_overlay: {
    isWrite: false,
    permissions: { domain: 'navigation', minTier: 1 },
    def: {
      name: 'open_overlay',
      description: 'Open or close a full-screen overlay for the user. target: "focus_lock" (distraction-free lock screen) or "clock" (ambient clock screensaver). action: "open" (default) or "close".',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', enum: ['focus_lock', 'clock'] },
          action: { type: 'string', enum: ['open', 'close'] },
        },
        required: ['target'],
      },
    },
    run: async (args) => {
      const target = String(args.target);
      const close = String(args.action ?? 'open') === 'close';
      const ov = useOverlayStore.getState();
      if (target === 'focus_lock') close ? ov.closeFocusLock() : ov.openFocusLock();
      else if (target === 'clock') close ? ov.closeClock() : ov.openClock();
      else return JSON.stringify({ ok: false, error: 'unknown target' });
      return JSON.stringify({ ok: true, target, action: close ? 'close' : 'open' });
    },
    summarize: (args, lang) => {
      const t = String(args.target) === 'clock' ? (lang === 'zh' ? '时钟屏保' : 'clock') : (lang === 'zh' ? '专注锁屏' : 'focus lock');
      const close = String(args.action ?? 'open') === 'close';
      return lang === 'zh' ? `${close ? '关闭' : '打开'}${t}` : `${close ? 'Close' : 'Open'} ${t}`;
    },
  },

  // ── Appearance / Schedule（外观与日程偏好，绝不含凭据/密钥）──────────────

  set_appearance: {
    isWrite: true,
    permissions: { domain: 'appearance', minTier: 2 },
    def: {
      name: 'set_appearance',
      description: 'Adjust appearance preferences. Only include fields to change. theme: "light"/"dark"/"system"; language: "zh"/"en"; accent: "coral"/"olive"/"sky"/"fig"; sortMode: "smart"/"manual".',
      parameters: {
        type: 'object',
        properties: {
          theme: { type: 'string', enum: ['light', 'dark', 'system'] },
          language: { type: 'string', enum: ['zh', 'en'] },
          accent: { type: 'string', enum: ['coral', 'olive', 'sky', 'fig'] },
          sortMode: { type: 'string', enum: ['smart', 'manual'] },
        },
      },
    },
    run: async (args) => {
      const s = useSettingsStore.getState();
      const changed: string[] = [];
      if (args.theme === 'light' || args.theme === 'dark' || args.theme === 'system') { s.setTheme(args.theme); changed.push('theme'); }
      if (args.language === 'zh' || args.language === 'en') { s.setLanguage(args.language); changed.push('language'); }
      if (args.accent === 'coral' || args.accent === 'olive' || args.accent === 'sky' || args.accent === 'fig') { s.setAccentColor(args.accent); changed.push('accent'); }
      if (args.sortMode === 'smart' || args.sortMode === 'manual') { s.setSortMode(args.sortMode); changed.push('sortMode'); }
      if (changed.length === 0) return JSON.stringify({ ok: false, error: 'no valid fields' });
      return JSON.stringify({ ok: true, changed });
    },
    summarize: (args, lang) => {
      const parts: string[] = [];
      if (args.theme) parts.push(lang === 'zh' ? `主题=${args.theme}` : `theme=${args.theme}`);
      if (args.language) parts.push(lang === 'zh' ? `语言=${args.language}` : `lang=${args.language}`);
      if (args.accent) parts.push(lang === 'zh' ? `强调色=${args.accent}` : `accent=${args.accent}`);
      if (args.sortMode) parts.push(lang === 'zh' ? `排序=${args.sortMode}` : `sort=${args.sortMode}`);
      return (lang === 'zh' ? '调整外观：' : 'Set appearance: ') + parts.join(', ');
    },
  },

  configure_reminders: {
    isWrite: true,
    permissions: { domain: 'schedule', minTier: 2 },
    def: {
      name: 'configure_reminders',
      description: 'Configure schedule preferences. weeklyReportEnabled: boolean; weeklyReportTime: "HH:MM"; achievementTime: "HH:MM" (daily achievement popup). Only include fields to change.',
      parameters: {
        type: 'object',
        properties: {
          weeklyReportEnabled: { type: 'boolean' },
          weeklyReportTime: { type: 'string' },
          achievementTime: { type: 'string' },
        },
      },
    },
    run: async (args) => {
      const s = useSettingsStore.getState();
      const changed: string[] = [];
      const timeRe = /^([01]?\d|2[0-3]):[0-5]\d$/;
      if (typeof args.weeklyReportEnabled === 'boolean') { s.setWeeklyReportEnabled(args.weeklyReportEnabled); changed.push('weeklyReportEnabled'); }
      if (typeof args.weeklyReportTime === 'string' && timeRe.test(args.weeklyReportTime)) { s.setWeeklyReportTime(args.weeklyReportTime); changed.push('weeklyReportTime'); }
      if (typeof args.achievementTime === 'string' && timeRe.test(args.achievementTime)) { s.setAchievementTime(args.achievementTime); changed.push('achievementTime'); }
      if (changed.length === 0) return JSON.stringify({ ok: false, error: 'no valid fields (time must be HH:MM)' });
      return JSON.stringify({ ok: true, changed });
    },
    summarize: (_args, lang) => (lang === 'zh' ? '调整日程提醒设置' : 'Configure reminders'),
  },

  // ── Notes: 灵感追加 ──────────────────────────────────────────────

  append_note: {
    isWrite: true,
    permissions: { domain: 'notes', minTier: 2 },
    def: {
      name: 'append_note',
      description: 'Append a line of text (e.g. a captured idea/inspiration) to the global scratchpad without overwriting existing content. Prepends a date stamp.',
      parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    },
    run: async (args) => {
      const text = String(args.text ?? '').trim();
      if (!text) return JSON.stringify({ ok: false, error: 'empty text' });
      const prev = useNotesStore.getState().scratchpad || '';
      const line = `${localDateKey()} ${text}`;
      useNotesStore.getState().setScratchpad(prev ? `${prev}\n${line}` : line);
      return JSON.stringify({ ok: true });
    },
    summarize: (args, lang) => {
      const t = String(args.text ?? '').slice(0, 20);
      return lang === 'zh' ? `记录灵感「${t}…」` : `Capture idea "${t}…"`;
    },
  },

  // ── Logs: 用量日志只读 ───────────────────────────────────────────

  get_usage_logs: {
    isWrite: false,
    permissions: { domain: 'logs', minTier: 1 },
    def: {
      name: 'get_usage_logs',
      description: 'Read AI usage logs (API call records / model usage). range: "today", "7d", "30d", "all". Returns aggregate summary + recent calls (provider, model, tokens, cost, status). No API keys exposed.',
      parameters: {
        type: 'object',
        properties: { range: { type: 'string', enum: ['today', '7d', '30d', 'all'] } },
      },
    },
    run: async (args) => {
      const range = typeof args.range === 'string' ? args.range : 'all';
      const logs = useUsageStore.getState().getLogs(range);
      const sum = summarizeUsage(logs);
      const recent = logs.slice(-15).map((r) => ({
        time: new Date(r.ts).toISOString(),
        provider: r.providerId, model: r.model, source: r.source,
        input: r.input, output: r.output, cost: Number(r.cost.toFixed(6)),
        status: r.status, durSec: Number(r.dur.toFixed(2)),
      }));
      return JSON.stringify({
        range,
        totals: {
          requests: sum.requests, inputTokens: sum.input, outputTokens: sum.output,
          cost: Number(sum.cost.toFixed(6)), successRate: Math.round(sum.successRate),
          cacheHitRate: Math.round(sum.cacheHitRate * 100),
        },
        recent,
      });
    },
    summarize: (args, lang) => {
      const r = typeof args.range === 'string' ? args.range : 'all';
      return lang === 'zh' ? `查看用量日志（${r}）` : `Get usage logs (${r})`;
    },
  },

  // ── Backup: 导出 / 云备份（数据搬运，每次强制确认）────────────────

  export_data: {
    isWrite: true,
    permissions: { domain: 'backup', minTier: 2 },
    alwaysConfirm: true,
    def: {
      name: 'export_data',
      description: 'Export todos to a file via a save dialog. format: "json", "csv", or "pdf". Opens the OS save dialog for the user to choose location.',
      parameters: {
        type: 'object',
        properties: { format: { type: 'string', enum: ['json', 'csv', 'pdf'] } },
        required: ['format'],
      },
    },
    run: async (args) => {
      const format = String(args.format);
      const todos = useTodoStore.getState().todos;
      const settings = useSettingsStore.getState();
      const lang = settings.language === 'en' ? 'en' : 'zh';
      const downloadPath = settings.downloadPath || '';
      const stamp = localDateKey();
      try {
        if (format === 'pdf') {
          const { exportTodosPDF } = await import('../pdf-export');
          await exportTodosPDF(todos, lang, 'classic', '', '', '', downloadPath);
          return JSON.stringify({ ok: true, format });
        }
        const { saveFileWithDialog, todosToCSV } = await import('../csv-export');
        const content = format === 'csv' ? todosToCSV(todos) : JSON.stringify(todos, null, 2);
        const mime = format === 'csv' ? 'text/csv' : 'application/json';
        const result = await saveFileWithDialog(content, `todoapp-${stamp}.${format}`, mime, downloadPath);
        return JSON.stringify({ ok: result === 'saved', result });
      } catch (e) {
        return JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    },
    summarize: (args, lang) =>
      lang === 'zh' ? `导出数据为 ${String(args.format).toUpperCase()}` : `Export data as ${String(args.format).toUpperCase()}`,
  },

  cloud_backup: {
    isWrite: true,
    permissions: { domain: 'backup', minTier: 2 },
    alwaysConfirm: true,
    def: {
      name: 'cloud_backup',
      description: 'Upload a full data backup to the user\'s pre-configured WebDAV cloud server. Fails with a hint if cloud backup is not configured in settings. Uses existing credentials — never reads or exposes them.',
      parameters: { type: 'object', properties: {} },
    },
    run: async () => {
      const s = useSettingsStore.getState();
      if (!s.cloudBackupUrl || !s.cloudBackupUser || !s.cloudBackupPass) {
        return JSON.stringify({ ok: false, error: 'cloud backup not configured', hint: 'ask user to set WebDAV url/user/password in Settings first' });
      }
      try {
        const { uploadBackupWebDAV } = await import('../cloudBackup');
        const res = await uploadBackupWebDAV(s.cloudBackupUrl, s.cloudBackupUser, s.cloudBackupPass);
        if (res.success) { s.setLastBackupAt(new Date().toISOString()); return JSON.stringify({ ok: true }); }
        return JSON.stringify({ ok: false, error: res.error });
      } catch (e) {
        return JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    },
    summarize: (_args, lang) => (lang === 'zh' ? '上传云备份到 WebDAV' : 'Upload cloud backup to WebDAV'),
  },

  // ── 智能分类（自然语言 → 标签 + 优先级）──────────────────────────

  auto_classify_todo: {
    isWrite: true,
    permissions: { domain: 'tags', minTier: 2 },
    def: {
      name: 'auto_classify_todo',
      description: 'Auto-classify a single todo: infer suitable tags and priority from its title, creating tags as needed and applying them. Get todoId from list_todos.',
      parameters: { type: 'object', properties: { todoId: { type: 'string' } }, required: ['todoId'] },
    },
    run: async (args) => {
      const todo = useTodoStore.getState().todos.find((t) => t.id === args.todoId);
      if (!todo) return JSON.stringify({ ok: false, error: 'todo not found' });
      const settings = useSettingsStore.getState();
      const lang = settings.language === 'en' ? 'en' : 'zh';
      try {
        const existing = useTagStore.getState().tags.map((t) => t.name);
        const { tags: suggested, priority } = await classifyTodo(todo.title, existing, lang);
        const tagStore = useTagStore.getState();
        const applied: string[] = [];
        for (const name of suggested.slice(0, 4)) {
          const trimmed = name.trim();
          if (!trimmed) continue;
          const found = tagStore.tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
          const tag = found ?? tagStore.addTag(trimmed, 'clay');
          tagStore.addTagToTodo(todo.id, tag.id);
          applied.push(tag.name);
        }
        if (priority >= 0 && priority <= 3) await useTodoStore.getState().setPriority(todo.id, clampPriority(priority));
        return JSON.stringify({ ok: true, tags: applied, priority });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return JSON.stringify({ ok: false, error: msg });
      }
    },
    summarize: (_args, lang) => (lang === 'zh' ? '智能分类（标签 + 优先级）' : 'Auto-classify (tags + priority)'),
  },
};

export function coworkToolDefs(compositeKey?: string): ToolDef[] {
  const all = Object.values(TOOL_REGISTRY);
  if (!compositeKey) return all.map((t) => t.def);
  return all
    .filter((t) => canExecuteTool(compositeKey, t.permissions))
    .map((t) => t.def);
}
