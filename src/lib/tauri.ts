import { invoke, listen } from '@tauri-apps/plugin-core';
import { open } from '@tauri-apps/plugin-sql';
import type { Todo } from '../store/todoStore';

// Database reference (lazy init)
let db: Awaited<ReturnType<typeof open>> | null = null;

async function getDB() {
  if (!db) {
    db = await open('sqlite:todos.db');
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
  } catch (e) {
    console.error('Failed to initialize database:', e);
  }
}

// Load all todos from database
export async function loadTodos(): Promise<Todo[]> {
  try {
    const database = await getDB();
    const rows = await database.select<
      {
        id: string;
        title: string;
        todo_type: string;
        deadline: string | null;
        completed: number;
        created_at: string;
        reminder_sent: number;
      }
    >(`
      SELECT id, title, todo_type, deadline, completed, created_at, reminder_sent
      FROM todos
      ORDER BY
        completed ASC,
        CASE
          WHEN todo_type = 'longterm' AND deadline IS NOT NULL THEN 1
          WHEN todo_type = 'longterm' THEN 2
          ELSE 3
        END,
        deadline ASC,
        created_at DESC
    `);

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      todoType: r.todo_type === 'longterm' ? 'longterm' : 'quick',
      deadline: r.deadline ?? null,
      completed: Boolean(r.completed),
      createdAt: r.created_at,
      reminderSent: Boolean(r.reminder_sent),
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
  deadline: string | null
): Promise<Todo | null> {
  try {
    const database = await getDB();
    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();

    await database.execute(
      `INSERT INTO todos (id, title, todo_type, deadline, completed, created_at) VALUES (?, ?, ?, ?, 0, ?)`,
      [id, title, todoType, deadline ?? null, created_at]
    );

    return {
      id,
      title,
      todoType: todoType === 'longterm' ? 'longterm' : 'quick',
      deadline: deadline ?? null,
      completed: false,
      createdAt: created_at,
      reminderSent: false,
    };
  } catch (e) {
    console.error('Failed to create todo:', e);
    return null;
  }
}

// Update a todo
export async function updateTodoInDB(
  id: string,
  updates: Partial<Pick<Todo, 'title' | 'todoType' | 'deadline' | 'completed'>>
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

    const rows = await database.select<{ id: string; title: string }>(
      `SELECT id, title FROM todos WHERE completed = 0 AND deadline IS NOT NULL AND deadline != '' AND deadline >= ? AND deadline <= ? ORDER BY deadline ASC`,
      [now, tomorrow]
    );

    for (const row of rows) {
      // Mark reminder as sent
      await database.execute('UPDATE todos SET reminder_sent = 1 WHERE id = ?', [row.id]);
      // Emit event for frontend to show notification
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

// Listen for events from backend
export function onStartupPrompt(callback: () => void): () => void {
  return listen('startup-prompt', callback);
}

export function onTodoReminder(callback: (todo: Todo) => void): () => void {
  return listen('todo-reminder', (event) => {
    const payload = event.payload as any;
    callback({
      id: payload.id,
      title: payload.title,
      todoType: payload.todo_type === 'longterm' ? 'longterm' : 'quick',
      deadline: payload.deadline ?? null,
      completed: payload.completed,
      createdAt: payload.created_at,
      reminderSent: payload.reminder_sent,
    });
  });
}
