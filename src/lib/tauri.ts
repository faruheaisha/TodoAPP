import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import Database from '@tauri-apps/plugin-sql';
import type { Todo } from '../store/todoStore';

// Database reference (lazy init)
//
// 重要：'sqlite:todos.db' 是相对路径，Tauri SQL 插件会在运行时
// 将其解析到操作系统的「应用数据目录」（例如 Windows 上的
// %APPDATA%/<bundle-identifier>/todos.db），而不是项目源码目录或
// 安装目录。这意味着：
//   1) 每个用户的待办数据完全独立存储在自己的系统账户下；
//   2) 该文件不会被打包进安装包，也不会出现在 git 仓库中
//      （已在 .gitignore 中显式排除 *.db）；
//   3) 开源后，其他用户下载并运行本应用时会拥有全新的空数据库，
//      不会看到原作者的个人数据。
// 如需自定义存储位置，可通过 plugin-store 持久化一个用户可配置的
// 路径，并在此处据此构造连接字符串（保持与「下载路径」设置同源的模式）。
let db: Database | null = null;

async function getDB(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:todos.db');
  }
  return db;
}

// Initialize the SQLite database
export async function initDB(): Promise<void> {
  try {
    const database = await getDB();
    await database.execute(`
      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        todo_type TEXT NOT NULL DEFAULT 'quick',
        deadline TEXT,
        completed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        reminder_sent INTEGER NOT NULL DEFAULT 0
      );
    `);
    // 迁移：为已有库补充新列（SQLite 无 ADD COLUMN IF NOT EXISTS，需先探测列）
    await ensureColumn(database, 'priority', 'INTEGER NOT NULL DEFAULT 0');
  } catch (e) {
    console.error('Failed to initialize database:', e);
  }
}

// 幂等地为 todos 表补充列：仅当列不存在时执行 ALTER TABLE
async function ensureColumn(database: Database, column: string, definition: string): Promise<void> {
  try {
    const cols = await database.select<{ name: string }[]>(`PRAGMA table_info(todos)`);
    if (cols.some((c) => c.name === column)) return;
    await database.execute(`ALTER TABLE todos ADD COLUMN ${column} ${definition}`);
  } catch (e) {
    console.error(`Failed to ensure column ${column}:`, e);
  }
}

// Load all todos from database
export async function loadTodos(): Promise<Todo[]> {
  try {
    const database = await getDB();
    const rows = await database.select<{
      id: string;
      title: string;
      todo_type: string;
      deadline: string | null;
      completed: number;
      created_at: string;
      reminder_sent: number;
      priority: number | null;
    }[]>(`
      SELECT id, title, todo_type, deadline, completed, created_at, reminder_sent, priority
      FROM todos
      ORDER BY
        completed ASC,
        priority DESC,
        CASE
          WHEN todo_type = 'longterm' AND deadline IS NOT NULL THEN 1
          WHEN todo_type = 'longterm' THEN 2
          ELSE 3
        END,
        deadline ASC,
        created_at DESC
    `);

    return rows.map((r: {
      id: string;
      title: string;
      todo_type: string;
      deadline: string | null;
      completed: number;
      created_at: string;
      reminder_sent: number;
      priority: number | null;
    }) => ({
      id: r.id,
      title: r.title,
      todoType: r.todo_type === 'longterm' ? 'longterm' : 'quick',
      deadline: r.deadline ?? null,
      completed: Boolean(r.completed),
      createdAt: r.created_at,
      reminderSent: Boolean(r.reminder_sent),
      priority: (r.priority ?? 0) as Todo['priority'],
    }));
  } catch (e) {
    console.error('Failed to load todos:', e);
    return [];
  }
}

// Create a new todo
export async function createTodoInDB(
  title: string,
  todoType: string,
  deadline: string | null,
  priority: number = 0
): Promise<Todo | null> {
  try {
    const database = await getDB();
    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();

    await database.execute(
      `INSERT INTO todos (id, title, todo_type, deadline, completed, created_at, priority) VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [id, title, todoType, deadline ?? null, created_at, priority]
    );

    return {
      id,
      title,
      todoType: todoType === 'longterm' ? 'longterm' : 'quick',
      deadline: deadline ?? null,
      completed: false,
      createdAt: created_at,
      reminderSent: false,
      priority: priority as Todo['priority'],
    };
  } catch (e) {
    console.error('Failed to create todo:', e);
    return null;
  }
}

// Update a todo
export async function updateTodoInDB(
  id: string,
  updates: Partial<Pick<Todo, 'title' | 'todoType' | 'deadline' | 'completed' | 'priority'>>
): Promise<void> {
  try {
    const database = await getDB();

    if (updates.title !== undefined) {
      await database.execute('UPDATE todos SET title = ? WHERE id = ?', [updates.title, id]);
    }
    if (updates.todoType !== undefined) {
      await database.execute('UPDATE todos SET todo_type = ? WHERE id = ?', [updates.todoType, id]);
    }
    if (updates.deadline !== undefined) {
      await database.execute('UPDATE todos SET deadline = ? WHERE id = ?', [updates.deadline ?? null, id]);
    }
    if (updates.completed !== undefined) {
      await database.execute('UPDATE todos SET completed = ? WHERE id = ?', [updates.completed ? 1 : 0, id]);
    }
    if (updates.priority !== undefined) {
      await database.execute('UPDATE todos SET priority = ? WHERE id = ?', [updates.priority, id]);
    }
  } catch (e) {
    console.error('Failed to update todo:', e);
  }
}

// Delete a todo
export async function deleteTodoInDB(id: string): Promise<void> {
  try {
    const database = await getDB();
    await database.execute('DELETE FROM todos WHERE id = ?', [id]);
  } catch (e) {
    console.error('Failed to delete todo:', e);
  }
}

// Check for due-soon todos
export async function checkDueSoon(): Promise<void> {
  try {
    const database = await getDB();
    const now = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const rows = await database.select<{ id: string; title: string }[]>(
      `SELECT id, title FROM todos WHERE completed = 0 AND deadline IS NOT NULL AND deadline != '' AND deadline >= ? AND deadline <= ? ORDER BY deadline ASC`,
      [now, tomorrow]
    );

    for (const row of rows) {
      await database.execute('UPDATE todos SET reminder_sent = 1 WHERE id = ?', [row.id]);
      window.dispatchEvent(new CustomEvent('todo-reminder', { detail: row }));
    }
  } catch (e) {
    console.error('Failed to check due soon:', e);
  }
}

// Clear reminder flags
export async function clearReminders(): Promise<void> {
  try {
    const database = await getDB();
    await database.execute('UPDATE todos SET reminder_sent = 0');
  } catch (e) {
    console.error('Failed to clear reminders:', e);
  }
}

// Listen for events from backend — returns a cleanup function
export async function onStartupPrompt(callback: () => void): Promise<UnlistenFn> {
  return listen('startup-prompt', callback);
}

export async function onTodoReminder(callback: (todo: Todo) => void): Promise<UnlistenFn> {
  return listen('todo-reminder', (event) => {
    const payload = event.payload as Record<string, unknown>;
    callback({
      id: (payload.id as string) ?? '',
      title: (payload.title as string) ?? '',
      todoType: (payload.todo_type as string) === 'longterm' ? 'longterm' : 'quick',
      deadline: (payload.deadline as string) ?? null,
      completed: Boolean(payload.completed),
      createdAt: (payload.created_at as string) ?? '',
      reminderSent: Boolean(payload.reminder_sent),
      priority: ((payload.priority as number) ?? 0) as Todo['priority'],
    });
  });
}
