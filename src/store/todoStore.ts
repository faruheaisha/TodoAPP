import { create } from 'zustand';
import {
  createTodoInDB,
  updateTodoInDB,
  deleteTodoInDB,
  clearReminders,
} from '../lib/tauri';

export type TodoType = 'quick' | 'longterm';

export interface Todo {
  id: string;
  title: string;
  todoType: TodoType;
  deadline: string | null;
  completed: boolean;
  createdAt: string;
  reminderSent: boolean;
}

interface TodoStore {
  todos: Todo[];
  isLoading: boolean;
  addTodo: (title: string, todoType?: TodoType, deadline?: string | null) => Promise<void>;
  updateTodo: (id: string, updates: Partial<Todo>) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  setTodos: (todos: Todo[]) => void;
  clearReminderFlags: () => Promise<void>;
}

export const useTodoStore = create<TodoStore>()((set, get) => ({
  todos: [],
  isLoading: true,

  addTodo: async (title, todoType = 'quick', deadline = null) => {
    const created = await createTodoInDB(title, todoType, deadline);
    if (created) {
      set((state) => ({ todos: [...state.todos, created] }));
    }
  },

  updateTodo: async (id, updates) => {
    await updateTodoInDB(id, {
      title: updates.title,
      todoType: updates.todoType,
      deadline: updates.deadline,
      completed: updates.completed,
    });
    set((state) => ({
      todos: state.todos.map((todo) =>
        todo.id === id ? { ...todo, ...updates } : todo
      ),
    }));
  },

  deleteTodo: async (id) => {
    await deleteTodoInDB(id);
    set((state) => ({
      todos: state.todos.filter((todo) => todo.id !== id),
    }));
  },

  toggleComplete: async (id) => {
    const todo = get().todos.find((t) => t.id === id);
    if (!todo) return;
    const newCompleted = !todo.completed;
    await updateTodoInDB(id, { completed: newCompleted });
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
