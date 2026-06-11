import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * notesStore — 快速笔记（P2.3）
 *
 * 两层结构：
 *  - scratchpad：随手记（全局一份，打开即写）
 *  - todoNotes：与 Todo 关联的备注（todoId → 文本）
 * 纯文本 + 自动保存（store 写入即落 persist），刻意不引入富文本依赖，
 * 保持包体与心智都轻。todo 删除时由 todoStore.deleteTodo 调用清理。
 */

interface NotesState {
  scratchpad: string;
  todoNotes: Record<string, string>;
  setScratchpad: (text: string) => void;
  setTodoNote: (todoId: string, text: string) => void;
  removeTodoNote: (todoId: string) => void;
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set) => ({
      scratchpad: '',
      todoNotes: {},

      setScratchpad: (scratchpad) => set({ scratchpad }),

      setTodoNote: (todoId, text) =>
        set((s) => {
          const todoNotes = { ...s.todoNotes };
          if (text) todoNotes[todoId] = text;
          else delete todoNotes[todoId];
          return { todoNotes };
        }),

      removeTodoNote: (todoId) =>
        set((s) => {
          if (!(todoId in s.todoNotes)) return s;
          const todoNotes = { ...s.todoNotes };
          delete todoNotes[todoId];
          return { todoNotes };
        }),
    }),
    { name: 'todoapp-notes', version: 1 }
  )
);
