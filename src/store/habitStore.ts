/**
 * habitStore — 习惯打卡状态管理
 *
 * 数据模型参考 Loop Habit Tracker (GitHub ⭐9.9k, iSoron/uhabits)：
 * - 每个习惯独立存储 checkIn 日期数组
 * - Streak 算法：今日未打卡不立即重置昨日连续，与 Loop 的「宽容模式」行为一致
 * - 颜色体系沿用 Anthropic 设计 token（clay / olive / sky / fig）
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type HabitColor = 'clay' | 'olive' | 'sky' | 'fig';

export const HABIT_COLORS: Record<HabitColor, string> = {
  clay:  '#d97757',
  olive: '#788c5d',
  sky:   '#6a9bcc',
  fig:   '#c46686',
};

export interface Habit {
  id: string;
  name: string;
  color: HabitColor;
  createdAt: string;   // ISO string
  checkIns: string[];  // 'YYYY-MM-DD'
}

/** 把 Date 转成 'YYYY-MM-DD' 字符串，用于 checkIn 存储与比较 */
export function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * 计算当前连续打卡天数
 * 借鉴 Loop Habit Tracker 的「宽容」策略：
 *   - 若今日已打卡 → 从今日开始向前连续计数
 *   - 若今日未打卡 → 从昨日开始（今日未打卡不立即清零昨日的连续）
 */
export function calcStreak(checkIns: Set<string>): number {
  const today = new Date();
  const todayKey = toDateKey(today);
  const offset = checkIns.has(todayKey) ? 0 : 1;
  let streak = 0;
  for (let i = offset; i <= 366; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (checkIns.has(toDateKey(d))) streak++;
    else break;
  }
  return streak;
}

interface HabitState {
  habits: Habit[];
  addHabit: (name: string, color: HabitColor) => void;
  removeHabit: (id: string) => void;
  toggleCheckIn: (id: string, date: string) => void;
}

export const useHabitStore = create<HabitState>()(
  persist(
    (set) => ({
      habits: [],

      addHabit: (name, color) =>
        set((s) => ({
          habits: [
            ...s.habits,
            {
              id: crypto.randomUUID(),
              name,
              color,
              createdAt: new Date().toISOString(),
              checkIns: [],
            },
          ],
        })),

      removeHabit: (id) =>
        set((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),

      toggleCheckIn: (id, date) =>
        set((s) => ({
          habits: s.habits.map((h) =>
            h.id !== id
              ? h
              : {
                  ...h,
                  checkIns: h.checkIns.includes(date)
                    ? h.checkIns.filter((d) => d !== date)
                    : [...h.checkIns, date],
                }
          ),
        })),
    }),
    { name: 'habit-store' }
  )
);
