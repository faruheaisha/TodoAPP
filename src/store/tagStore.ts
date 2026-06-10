/**
 * tagStore — 标签系统
 *
 * 参考：
 *  - Todoist Labels (⭐29.6k)：标签颜色 + 全局过滤
 *  - Things 3 Tags：轻量标签、多标签组合过滤
 *  - Linear Labels：预设调色板 + 自定义颜色
 *
 * 设计：
 *  - tags: 全局标签定义（id, name, color）
 *  - todoTags: todoId → tagId[] 映射（避免修改 SQLite schema）
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Tag {
  id: string;
  name: string;
  color: string; // hex
}

// Anthropic 调色板扩展 — 8 个预设色
export const TAG_PALETTE = [
  '#d97757', // clay (accent)
  '#788c5d', // olive
  '#6a9bcc', // sky
  '#c46686', // fig
  '#e8a838', // amber
  '#5ba89a', // teal
  '#9b72cf', // purple
  '#7a7a7a', // neutral
];

interface TagState {
  tags: Tag[];
  todoTags: Record<string, string[]>; // todoId → tagIds

  addTag: (name: string, color: string) => Tag;
  removeTag: (tagId: string) => void;
  updateTag: (tagId: string, updates: Partial<Pick<Tag, 'name' | 'color'>>) => void;

  setTodoTags: (todoId: string, tagIds: string[]) => void;
  addTagToTodo: (todoId: string, tagId: string) => void;
  removeTagFromTodo: (todoId: string, tagId: string) => void;
  removeAllForTodo: (todoId: string) => void;
  getTodoTags: (todoId: string) => Tag[];
}

export const useTagStore = create<TagState>()(
  persist(
    (set, get) => ({
      tags: [],
      todoTags: {},

      addTag: (name, color) => {
        const tag: Tag = { id: crypto.randomUUID(), name, color };
        set((s) => ({ tags: [...s.tags, tag] }));
        return tag;
      },

      removeTag: (tagId) =>
        set((s) => {
          // Remove from all todos
          const todoTags: Record<string, string[]> = {};
          for (const [tid, ids] of Object.entries(s.todoTags)) {
            const filtered = ids.filter(id => id !== tagId);
            if (filtered.length > 0) todoTags[tid] = filtered;
          }
          return {
            tags: s.tags.filter(t => t.id !== tagId),
            todoTags,
          };
        }),

      updateTag: (tagId, updates) =>
        set((s) => ({
          tags: s.tags.map(t => t.id !== tagId ? t : { ...t, ...updates }),
        })),

      setTodoTags: (todoId, tagIds) =>
        set((s) => ({
          todoTags: { ...s.todoTags, [todoId]: tagIds },
        })),

      addTagToTodo: (todoId, tagId) =>
        set((s) => {
          const existing = s.todoTags[todoId] ?? [];
          if (existing.includes(tagId)) return s;
          return { todoTags: { ...s.todoTags, [todoId]: [...existing, tagId] } };
        }),

      removeTagFromTodo: (todoId, tagId) =>
        set((s) => {
          const existing = s.todoTags[todoId] ?? [];
          const next = existing.filter(id => id !== tagId);
          const todoTags = { ...s.todoTags };
          if (next.length === 0) delete todoTags[todoId];
          else todoTags[todoId] = next;
          return { todoTags };
        }),

      removeAllForTodo: (todoId) =>
        set((s) => {
          const todoTags = { ...s.todoTags };
          delete todoTags[todoId];
          return { todoTags };
        }),

      getTodoTags: (todoId) => {
        const { tags, todoTags } = get();
        const ids = todoTags[todoId] ?? [];
        return ids.map(id => tags.find(t => t.id === id)).filter(Boolean) as Tag[];
      },
    }),
    { name: 'todoapp-tags' }
  )
);
