// CSV export utility
import type { Todo } from '../store/todoStore';

function escapeCSV(value: unknown): string {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function getRowValue(row: Record<string, string>, candidates: string[]): string {
  for (const key of candidates) {
    const found = Object.keys(row).find((k) => k.trim().toLowerCase() === key.toLowerCase());
    if (found) return row[found] ?? '';
  }
  return '';
}

function parseNumberInRange(raw: string, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed >= min && parsed <= max) return parsed;
  return fallback;
}

export function todosToCSV(todos: Todo[]): string {
  const headers = ['ID', 'Title', 'Type', 'Deadline', 'Completed', 'Created At', 'Priority', 'Sort Order'];
  const rows = todos.map((todo) => [
    todo.id,
    todo.title,
    todo.todoType,
    todo.deadline || '',
    todo.completed ? 'Yes' : 'No',
    todo.createdAt,
    todo.priority ?? 0,
    todo.sortOrder ?? 0,
  ].map(escapeCSV));

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/** Parse CSV text back to Todo array */
export function parseCSVToTodos(csv: string): Todo[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = values[i] ?? ''; });
    const title = getRowValue(row, ['Title']);
    const type = getRowValue(row, ['Type']);
    const completed = getRowValue(row, ['Completed']).toLowerCase();
    return {
      id: getRowValue(row, ['ID']) || crypto.randomUUID(),
      title,
      todoType: (type === 'quick' || type === 'longterm') ? type : 'quick',
      deadline: getRowValue(row, ['Deadline']) || null,
      completed: completed === 'yes' || completed === 'true' || completed === '1' || completed === 'done',
      createdAt: getRowValue(row, ['Created At', 'CreatedAt']) || new Date().toISOString(),
      reminderSent: false,
      priority: parseNumberInRange(getRowValue(row, ['Priority']), 0, 3, 0) as Todo['priority'],
      sortOrder: parseNumberInRange(getRowValue(row, ['Sort Order', 'SortOrder']), 0, Number.MAX_SAFE_INTEGER, 0),
    } satisfies Todo;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { result.push(current); current = ''; }
      else current += ch;
    }
  }
  result.push(current);
  return result;
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

/** 使用 Tauri save 对话框将文本内容保存到用户指定路径
 *  @returns { status: 'saved' | 'cancelled' | 'error' }
 *   - 'saved': 用户选择了路径并成功写入
 *   - 'cancelled': 用户关闭了对话框（未选择路径）
 *   - 'error': 写入过程发生异常
 */
export async function saveFileWithDialog(
  content: string,
  filename: string,
  mimeType: string,
  downloadPath: string = '',
): Promise<'saved' | 'cancelled' | 'error'> {
  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const defaultPath = downloadPath ? downloadPath + '/' + filename : filename;
    const ext = filename.split('.').pop() ?? '*';
    const path = await save({ defaultPath, filters: [{ name: 'File', extensions: [ext] }] });
    if (!path) return 'cancelled';
    await writeFile(path, new TextEncoder().encode(content));
    return 'saved';
  } catch {
    return 'error';
  }
}
