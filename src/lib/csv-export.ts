// CSV export utility
import type { Todo } from '../store/todoStore';

export function todosToCSV(todos: Todo[]): string {
  const headers = ['ID', 'Title', 'Type', 'Deadline', 'Completed', 'Created At'];
  const rows = todos.map((todo) => [
    todo.id,
    `"${todo.title.replace(/"/g, '""')}"`,
    todo.todoType,
    todo.deadline || '',
    todo.completed ? 'Yes' : 'No',
    todo.createdAt,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportTodosJSON(todos: Todo[], filename: string): void {
  const json = JSON.stringify(todos, null, 2);
  downloadFile(json, filename, 'application/json');
}

export function exportTodosCSV(todos: Todo[], filename: string): void {
  const csv = todosToCSV(todos);
  downloadFile(csv, filename, 'text/csv');
}
