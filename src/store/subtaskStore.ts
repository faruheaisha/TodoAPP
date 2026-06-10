/**
 * subtaskStore — Todo 子任务状态管理
 *
 * 使用 Zustand persist（localStorage）存储，避免修改 SQLite schema。
 * 数据结构：todoId → SubTask[]
 *
 * 参考项目：
 *  - Todoist (子任务展开/折叠 + 进度圆圈，工业标准)
 *  - Things 3 (Checklist，轻量无层级，行内展开)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

interface SubtaskState {
  /** todoId → SubTask[] */
  subtasks: Record<string, SubTask[]>;

  addSubtask: (todoId: string, title: string) => void;
  toggleSubtask: (todoId: string, subtaskId: string) => void;
  deleteSubtask: (todoId: string, subtaskId: string) => void;
  /** 删除某 todo 的所有子任务（在 todoStore.deleteTodo 中调用） */
  deleteAllForTodo: (todoId: string) => void;
  getSubtasks: (todoId: string) => SubTask[];
}

export const useSubtaskStore = create<SubtaskState>()(
  persist(
    (set, get) => ({
      subtasks: {},

      addSubtask: (todoId, title) =>
        set((s) => ({
          subtasks: {
            ...s.subtasks,
            [todoId]: [
              ...(s.subtasks[todoId] ?? []),
              {
                id: crypto.randomUUID(),
                title: title.trim(),
                completed: false,
                createdAt: new Date().toISOString(),
              },
            ],
          },
        })),

      toggleSubtask: (todoId, subtaskId) =>
        set((s) => ({
          subtasks: {
            ...s.subtasks,
            [todoId]: (s.subtasks[todoId] ?? []).map((st) =>
              st.id === subtaskId ? { ...st, completed: !st.completed } : st
            ),
          },
        })),

      deleteSubtask: (todoId, subtaskId) =>
        set((s) => ({
          subtasks: {
            ...s.subtasks,
            [todoId]: (s.subtasks[todoId] ?? []).filter((st) => st.id !== subtaskId),
          },
        })),

      deleteAllForTodo: (todoId) =>
        set((s) => {
          const next = { ...s.subtasks };
          delete next[todoId];
          return { subtasks: next };
        }),

      getSubtasks: (todoId) => get().subtasks[todoId] ?? [],
    }),
    { name: 'todoapp-subtasks' }
  )
);
