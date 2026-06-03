import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  addTodo: (title: string, todoType?: TodoType, deadline?: string | null) => void;
  updateTodo: (id: string, updates: Partial<Todo>) => void;
  deleteTodo: (id: string) => void;
  toggleComplete: (id: string) => void;
  loadTodos: (todos: Todo[]) => void;
  clearReminderFlags: () => void;
  setTodos: (todos: Todo[]) => void;
}

export const useTodoStore = create<TodoStore>()(
  persist(
    (set, get) => ({
      todos: [],
      isLoading: false,

      addTodo: (title, todoType = 'quick', deadline = null) => {
        const newTodo: Todo = {
          id: crypto.randomUUID(),
          title,
          todoType,
          deadline,
          completed: false,
          createdAt: new Date().toISOString(),
          reminderSent: false,
        };
        set((state) => ({
          todos: [...state.todos, newTodo],
        }));
      },

      updateTodo: (id, updates) => {
        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === id ? { ...todo, ...updates } : todo
          ),
        }));
      },

      deleteTodo: (id) => {
        set((state) => ({
          todos: state.todos.filter((todo) => todo.id !== id),
        }));
      },

      toggleComplete: (id) => {
        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === id
              ? { ...todo, completed: !todo.completed }
              : todo
          ),
        }));
      },

      loadTodos: (todos) => {
        set({ todos, isLoading: false });
      },

      clearReminderFlags: () => {
        set((state) => ({
          todos: state.todos.map((todo) => ({
            ...todo,
            reminderSent: false,
          })),
        }));
      },

      setTodos: (todos) => {
        set({ todos });
      },
    }),
    {
      name: 'todoapp-todos',
    }
  )
);
