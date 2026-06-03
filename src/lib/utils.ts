import type { Todo } from '../store/todoStore';

// Sort todos: longterm by deadline ascending, quick by created_at descending
export function sortTodos(todos: Todo[]): Todo[] {
  const quick = todos.filter((t) => t.todoType === 'quick');
  const longterm = todos.filter((t) => t.todoType === 'longterm');

  // Sort longterm: overdue first, then by deadline ascending
  const now = new Date();
  longterm.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
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

  // Sort quick: by created_at descending (newest first)
  quick.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
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
