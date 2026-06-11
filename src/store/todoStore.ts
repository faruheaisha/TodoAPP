import { create } from 'zustand';
import {
  createTodoInDB,
  updateTodoInDB,
  deleteTodoInDB,
  clearReminders,
} from '../lib/tauri';
import { useCompletionStore } from './completionStore';
import { useSubtaskStore } from './subtaskStore';
import { useRecurrenceStore, getNextDeadline } from './recurrenceStore';
import { useTagStore } from './tagStore';

export type TodoType = 'quick' | 'longterm';

/** 优先级：0=无 1=低(P3) 2=中(P2) 3=高(P1)，对应 Todoist 的 P1-P4 体系 */
export type Priority = 0 | 1 | 2 | 3;

export interface Todo {
  id: string;
  title: string;
  todoType: TodoType;
  deadline: string | null;
  completed: boolean;
  createdAt: string;
  reminderSent: boolean;
  priority: Priority;
}

interface TodoStore {
  todos: Todo[];
  isLoading: boolean;
  addTodo: (title: string, todoType?: TodoType, deadline?: string | null, priority?: Priority) => Promise<void>;
  updateTodo: (id: string, updates: Partial<Todo>) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  setPriority: (id: string, priority: Priority) => Promise<void>;
  setTodos: (todos: Todo[]) => void;
  clearReminderFlags: () => Promise<void>;
}

export const useTodoStore = create<TodoStore>()((set, get) => ({
  todos: [],
  isLoading: true,

  addTodo: async (title, todoType = 'quick', deadline = null, priority = 0) => {
    const created = await createTodoInDB(title, todoType, deadline, priority);
    if (created) {
      set((state) => ({ todos: [...state.todos, created] }));
    }
  },

  setPriority: async (id, priority) => {
    await updateTodoInDB(id, { priority });
    set((state) => ({
      todos: state.todos.map((todo) =>
        todo.id === id ? { ...todo, priority } : todo
      ),
    }));
  },

  updateTodo: async (id, updates) => {
    await updateTodoInDB(id, {
      title: updates.title,
      todoType: updates.todoType,
      deadline: updates.deadline,
      completed: updates.completed,
      priority: updates.priority,
    });
    set((state) => ({
      todos: state.todos.map((todo) =>
        todo.id === id ? { ...todo, ...updates } : todo
      ),
    }));
  },

  deleteTodo: async (id) => {
    await deleteTodoInDB(id);
    useCompletionStore.getState().removeCompletionTime(id);
    useSubtaskStore.getState().deleteAllForTodo(id);
    useRecurrenceStore.getState().removeRule(id);
    useTagStore.getState().removeAllForTodo(id);
    const { useNotesStore } = await import('./notesStore');
    useNotesStore.getState().removeTodoNote(id);
    set((state) => ({
      todos: state.todos.filter((todo) => todo.id !== id),
    }));
  },

  toggleComplete: async (id) => {
    const todo = get().todos.find((t) => t.id === id);
    if (!todo) return;
    const newCompleted = !todo.completed;
    await updateTodoInDB(id, { completed: newCompleted });
    // 完成时记录时间戳，取消完成时清除
    if (newCompleted) {
      useCompletionStore.getState().setCompletionTime(id, new Date().toISOString());
      // 「完成即重生」：若有重复规则，自动创建下一条（Things 3 / Todoist 模式）
      const rule = useRecurrenceStore.getState().getRule(id);
      if (rule) {
        const nextDeadline = getNextDeadline(rule.type, todo.deadline);
        const created = await createTodoInDB(todo.title, todo.todoType, nextDeadline, todo.priority);
        if (created) {
          useRecurrenceStore.getState().setRule(created.id, rule);
          set((state) => ({
            todos: [...state.todos.map((t) =>
              t.id === id ? { ...t, completed: newCompleted } : t
            ), created],
          }));
          return;
        }
      }
    } else {
      useCompletionStore.getState().removeCompletionTime(id);
    }
    set((state) => ({
      todos: state.todos.map((t) =>
        t.id === id ? { ...t, completed: newCompleted } : t
      ),
    }));
  },

  setTodos: (todos) => {
    set({ todos, isLoading: false });
  },

  clearReminderFlags: async () => {
    await clearReminders();
    set((state) => ({
      todos: state.todos.map((todo) => ({
        ...todo,
        reminderSent: false,
      })),
    }));
  },
}));
