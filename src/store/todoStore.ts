import { create } from 'zustand';
import {
  createTodoInDB,
  updateTodoInDB,
  deleteTodoInDB,
  deleteAllTodosInDB,
  bulkInsertTodosInDB,
  updateSortOrdersInDB,
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
  /** 手动排序序号（sortMode='manual' 时生效，越小越靠前） */
  sortOrder: number;
}

interface TodoStore {
  todos: Todo[];
  isLoading: boolean;
  addTodo: (title: string, todoType?: TodoType, deadline?: string | null, priority?: Priority) => Promise<void>;
  updateTodo: (id: string, updates: Partial<Todo>) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  setPriority: (id: string, priority: Priority) => Promise<void>;
  /** 手动模式拖拽重排：传入某分区拖拽后的完整 id 顺序，重写其 sortOrder 并持久化 */
  reorderTodos: (orderedIds: string[]) => Promise<void>;
  setTodos: (todos: Todo[]) => void;
  clearReminderFlags: () => Promise<void>;
  /** 将截止日期已过的未完成任务自动标记为已完成（App 启动时调用） */
  autoCompleteExpired: () => Promise<void>;
  /** 清理超过 6 个月的已完成任务（按 createdAt 计算），App 启动时调用 */
  cleanupOldCompleted: () => Promise<void>;
  /** 删除所有 todos（全量替换导入时使用），同步清空 SQLite + 内存 */
  deleteAllTodos: () => Promise<void>;
  /** 批量插入 todos（导入用），写入 SQLite + 追加内存 */
  bulkImportTodos: (todos: Todo[]) => Promise<void>;
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

  reorderTodos: async (orderedIds) => {
    // 以被拖拽分区原有 sortOrder 的升序值集为槽位，按新顺序重新分配，
    // 不影响其他分区的相对次序
    const { todos } = get();
    const affected = todos.filter((t) => orderedIds.includes(t.id));
    const slots = affected.map((t) => t.sortOrder).sort((a, b) => a - b);
    const pairs = orderedIds.map((id, i) => ({ id, sortOrder: slots[i] ?? i }));
    const map = new Map(pairs.map((p) => [p.id, p.sortOrder]));
    set((state) => ({
      todos: state.todos.map((t) =>
        map.has(t.id) ? { ...t, sortOrder: map.get(t.id)! } : t
      ),
    }));
    await updateSortOrdersInDB(pairs);
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

  autoCompleteExpired: async () => {
    const now = new Date();
    // 以今天凌晨为基准：只有截止日整天结束（即昨天及更早到期）才算过期，
    // 今天稍晚到期的任务不应在启动时被误判完成
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const { todos } = get();
    const expired = todos.filter((t) => {
      if (t.completed || !t.deadline) return false;
      try {
        const dl = new Date(t.deadline);
        return dl < todayStart && !isNaN(dl.getTime());
      } catch { return false; }
    });
    for (const todo of expired) {
      await updateTodoInDB(todo.id, { completed: true });
      useCompletionStore.getState().setCompletionTime(todo.id, new Date().toISOString());
    }
    if (expired.length > 0) {
      const expiredIds = new Set(expired.map((t) => t.id));
      set((state) => ({
        todos: state.todos.map((t) =>
          expiredIds.has(t.id) ? { ...t, completed: true } : t
        ),
      }));
    }
  },

  cleanupOldCompleted: async () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const { todos } = get();
    const stale = todos.filter((t) => {
      if (!t.completed) return false;
      try {
        const created = new Date(t.createdAt);
        return created < sixMonthsAgo && !isNaN(created.getTime());
      } catch { return false; }
    });
    for (const todo of stale) {
      await deleteTodoInDB(todo.id);
      useCompletionStore.getState().removeCompletionTime(todo.id);
      useSubtaskStore.getState().deleteAllForTodo(todo.id);
      useRecurrenceStore.getState().removeRule(todo.id);
      useTagStore.getState().removeAllForTodo(todo.id);
    }
    if (stale.length > 0) {
      const staleIds = new Set(stale.map((t) => t.id));
      set((state) => ({
        todos: state.todos.filter((t) => !staleIds.has(t.id)),
      }));
    }
  },

  deleteAllTodos: async () => {
    const { todos } = get();
    await deleteAllTodosInDB();
    for (const todo of todos) {
      useCompletionStore.getState().removeCompletionTime(todo.id);
      useSubtaskStore.getState().deleteAllForTodo(todo.id);
      useRecurrenceStore.getState().removeRule(todo.id);
      useTagStore.getState().removeAllForTodo(todo.id);
    }
    const { useNotesStore } = await import('./notesStore');
    for (const todo of todos) {
      useNotesStore.getState().removeTodoNote(todo.id);
    }
    set({ todos: [] });
  },

  bulkImportTodos: async (todos) => {
    await bulkInsertTodosInDB(todos);
    set((state) => ({ todos: [...state.todos, ...todos] }));
  },
}));
