import { invoke, listen } from '@tauri-apps/plugin-core';
import type { Todo } from '../store/todoStore';

// Initialize the SQLite database
export async function initDB(): Promise<void> {
  try {
    await invoke('init_database');
  } catch (e) {
    console.error('Failed to initialize database:', e);
  }
}

// Load all todos from database
export async function loadTodos(): Promise<Todo[]> {
  try {
    const result = await invoke<any>('get_all_todos');
    return result.map((r: any) => ({
      id: r.id,
      title: r.title,
      todoType: r.todo_type === 'longterm' ? 'longterm' : 'quick',
      deadline: r.deadline ?? null,
      completed: r.completed,
      createdAt: r.created_at,
      reminderSent: r.reminder_sent,
    }));
  } catch (e) {
    console.error('Failed to load todos:', e);
    return [];
  }
}

// Create a new todo in database
export async function createTodoInDB(
  title: string,
  todoType: string,
  deadline: string | null
): Promise<Todo | null> {
  try {
    const result = await invoke<any>('create_todo', {
      title,
      todoType: todoType === 'longterm' ? 'Longterm' : 'Quick',
      deadline,
    });
    return {
      id: result.id,
      title: result.title,
      todoType: result.todo_type === 'longterm' ? 'longterm' : 'quick',
      deadline: result.deadline ?? null,
      completed: result.completed,
      createdAt: result.created_at,
      reminderSent: result.reminder_sent,
    };
  } catch (e) {
    console.error('Failed to create todo:', e);
    return null;
  }
}

// Update a todo in database
export async function updateTodoInDB(
  id: string,
  updates: Partial<Pick<Todo, 'title' | 'todoType' | 'deadline' | 'completed'>>
): Promise<void> {
  try {
    await invoke('update_todo', {
      id,
      title: updates.title ?? null,
      todoType: updates.todoType
        ? updates.todoType === 'longterm'
          ? 'Longterm'
          : 'Quick'
        : null,
      deadline: updates.deadline ?? null,
      completed: updates.completed ?? null,
    });
  } catch (e) {
    console.error('Failed to update todo:', e);
  }
}

// Delete a todo from database
export async function deleteTodoInDB(id: string): Promise<void> {
  try {
    await invoke('delete_todo', { id });
  } catch (e) {
    console.error('Failed to delete todo:', e);
  }
}

// Check for due-soon todos
export async function checkDueSoon(): Promise<void> {
  try {
    await invoke('check_due_soon_todos');
  } catch (e) {
    console.error('Failed to check due soon:', e);
  }
}

// Clear reminder flags
export async function clearReminders(): Promise<void> {
  try {
    await invoke('clear_reminder_flags');
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
