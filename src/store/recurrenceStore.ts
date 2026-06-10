/**
 * recurrenceStore — 重复任务规则存储
 *
 * 使用 Zustand persist 避免修改 SQLite schema。
 * 数据：todoId → RecurrenceRule
 *
 * 完成重复任务后，todoStore.toggleComplete 会自动创建下一条（Things 3 「完成即重生」模式）。
 *
 * 参考：
 *  - Todoist 重复任务（every day / every weekday / every week / every month）
 *  - Things 3 Repeating Tasks（完成旧实例 → 自动生成下一个 deadline 的新实例）
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RecurrenceType = 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface RecurrenceRule {
  type: RecurrenceType;
}

export const RECURRENCE_OPTIONS: { type: RecurrenceType; labelZh: string; labelEn: string; icon: string }[] = [
  { type: 'daily',    labelZh: '每天',  labelEn: 'Every day',     icon: '⏱' },
  { type: 'weekdays', labelZh: '工作日', labelEn: 'Weekdays',      icon: '🗓' },
  { type: 'weekly',   labelZh: '每周',  labelEn: 'Every week',    icon: '📅' },
  { type: 'monthly',  labelZh: '每月',  labelEn: 'Every month',   icon: '🗃' },
];

/**
 * 根据当前 deadline（或今天）计算下一次到期时间
 * 参考 Todoist Next Date 算法
 */
export function getNextDeadline(type: RecurrenceType, currentDeadline: string | null): string {
  const base = currentDeadline ? new Date(currentDeadline) : new Date();
  const next = new Date(base);

  switch (type) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekdays': {
      next.setDate(next.getDate() + 1);
      // 跳过周末
      while (next.getDay() === 0 || next.getDay() === 6) {
        next.setDate(next.getDate() + 1);
      }
      break;
    }
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
  }

  // 格式化为 datetime-local 字符串（YYYY-MM-DDTHH:MM）
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`;
}

interface RecurrenceState {
  rules: Record<string, RecurrenceRule>; // todoId → rule

  setRule: (todoId: string, rule: RecurrenceRule) => void;
  removeRule: (todoId: string) => void;
  getRule: (todoId: string) => RecurrenceRule | null;
}

export const useRecurrenceStore = create<RecurrenceState>()(
  persist(
    (set, get) => ({
      rules: {},

      setRule: (todoId, rule) =>
        set((s) => ({ rules: { ...s.rules, [todoId]: rule } })),

      removeRule: (todoId) =>
        set((s) => {
          const next = { ...s.rules };
          delete next[todoId];
          return { rules: next };
        }),

      getRule: (todoId) => get().rules[todoId] ?? null,
    }),
    { name: 'todoapp-recurrence' }
  )
);
