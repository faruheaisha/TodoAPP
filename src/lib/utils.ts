import type { Todo } from '../store/todoStore';
import type { SortMode } from '../store/settingsStore';

/**
 * localDateKey — 本地时区的 YYYY-MM-DD 日期键
 *
 * 统一全应用的「今天」判定：用 Date 的本地分量（自动跟随操作系统当前时区），
 * 避免 toISOString() 的 UTC 偏移导致跨时区（如 UTC+8）日期边界提前。
 */
export function localDateKey(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * classifyTodo — 根据截止时间对任务分类
 */
export function classifyTodo(todo: Todo): 'overdue' | 'due_today' | 'due_soon' | 'upcoming' | 'no_deadline' {
  if (!todo.deadline || todo.completed) return 'no_deadline';
  const now = new Date();
  const d = new Date(todo.deadline);
  if (d < now) return 'overdue';
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  ) return 'due_today';
  const diff = d.getTime() - now.getTime();
  if (diff <= 48 * 60 * 60 * 1000) return 'due_soon';
  return 'upcoming';
}

/** 任务是否应在今日视图中标为过期但今天完成了（应审查） */
export function isExpiredToday(todo: Todo, completionTimes: Record<string, string>): boolean {
  if (!todo.completed || !todo.deadline) return false;
  const completionTime = completionTimes[todo.id];
  if (!completionTime) return false;
  const deadline = new Date(todo.deadline);
  const completed = new Date(completionTime);
  return deadline < completed && completed.toDateString() === new Date().toDateString();
}

// Sort todos:
//  - smart  : longterm 按优先级→截止时间，quick 按优先级→创建时间（默认）
//  - manual : 未完成任务一律按 sortOrder 升序（用户拖拽决定）
export function sortTodos(todos: Todo[], mode: SortMode = 'smart'): Todo[] {
  const quick = todos.filter((t) => t.todoType === 'quick');
  const longterm = todos.filter((t) => t.todoType === 'longterm');

  if (mode === 'manual') {
    const bySortOrder = (a: Todo, b: Todo) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return a.sortOrder - b.sortOrder;
    };
    longterm.sort(bySortOrder);
    quick.sort(bySortOrder);
    return [
      ...longterm.filter((t) => !t.completed),
      ...quick.filter((t) => !t.completed),
      ...longterm.filter((t) => t.completed),
      ...quick.filter((t) => t.completed),
    ];
  }

  // Sort longterm: priority desc → overdue first → deadline ascending
  const now = new Date();
  longterm.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.deadline && b.deadline) {
      const aDate = new Date(a.deadline);
      const bDate = new Date(b.deadline);
      const aOverdue = aDate < now ? 1 : 0;
      const bOverdue = bDate < now ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;
      return aDate.getTime() - bDate.getTime();
    }
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  // Sort quick: priority desc → created_at descending (newest first)
  quick.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return [...longterm.filter((t) => t.completed === false), ...quick.filter((t) => t.completed === false), ...longterm.filter((t) => t.completed), ...quick.filter((t) => t.completed)];
}

// Check if a todo is urgent (due within 24 hours)
export function isUrgent(todo: Todo): boolean {
  if (!todo.deadline || todo.completed) return false;
  const deadline = new Date(todo.deadline);
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  return diff > 0 && diff < 24 * 60 * 60 * 1000;
}

// Check if a todo is overdue
export function isOverdue(todo: Todo): boolean {
  if (!todo.deadline || todo.completed) return false;
  return new Date(todo.deadline) < new Date();
}

// Check if a todo is due today (deadline falls on the current calendar day)
export function isDueToday(todo: Todo): boolean {
  if (!todo.deadline || todo.completed) return false;
  const d = new Date(todo.deadline);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// 今日视图所含任务：未完成，且「今天到期」或「已逾期」
export function isInTodayView(todo: Todo): boolean {
  if (todo.completed) return false;
  return isOverdue(todo) || isDueToday(todo);
}

// Format deadline for display
export function formatDeadline(deadline: string | null, lang: 'zh' | 'en'): string {
  if (!deadline) return lang === 'zh' ? '无截止时间' : 'No deadline';
  const date = new Date(deadline);
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (lang === 'zh') {
    if (diff < 0) return '已过期';
    if (diff < 60 * 60 * 1000) return '1小时内';
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.ceil(diff / (60 * 60 * 1000));
      return `${hours}小时后`;
    }
    if (date.toDateString() === new Date(Date.now() + 86400000).toDateString()) return '明天';
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  } else {
    if (diff < 0) return 'Overdue';
    if (diff < 60 * 60 * 1000) return 'In 1h';
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.ceil(diff / (60 * 60 * 1000));
      return `In ${hours}h`;
    }
    if (date.toDateString() === new Date(Date.now() + 86400000).toDateString()) return 'Tomorrow';
    return `${date.toLocaleString('en', { month: 'short' })} ${date.getDate()}`;
  }
}
