/**
 * habitStore — 习惯打卡状态管理 v2
 *
 * 参考项目：
 *  - Loop Habit Tracker (GitHub ⭐9.9k, iSoron/uhabits)：
 *    每习惯独立提醒时间、30天完成率评分、宽容连续算法
 *  - Habitica (GitHub ⭐13.9k)：
 *    里程碑勋章体系、打卡奖励反馈
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
  createdAt: string;
  checkIns: string[];          // 'YYYY-MM-DD'
  reminderEnabled: boolean;
  reminderTime: string;        // 'HH:MM'，空字符串表示未设置
  note: string;                // 习惯备注/动机文字
  milestonesShown: number[];   // 已展示庆祝的里程碑天数（避免重复弹出）
  /** 打卡模式：每日 or 弹性（每周 N 次） — 参考 Loop Habit Tracker Frequency */
  frequency: 'daily' | 'flexible';
  /** 弹性模式下每周目标次数（1-6），frequency==='daily' 时忽略 */
  weeklyTarget: number;
}

// ─── 里程碑配置（Loop / Habitica 参考）────────────────────────────────────────
export interface Milestone {
  days: number;
  label: string;
  labelEn: string;
  icon: string;
}

export const MILESTONES: Milestone[] = [
  { days: 7,   label: '7天入门',   labelEn: '7-Day Starter',    icon: '🥉' },
  { days: 21,  label: '21天习惯',  labelEn: '21-Day Habit',     icon: '🥈' },
  { days: 30,  label: '30天坚持',  labelEn: '30-Day Achiever',  icon: '🥇' },
  { days: 100, label: '100天钻石', labelEn: '100-Day Diamond',  icon: '💎' },
  { days: 365, label: '365天传奇', labelEn: '365-Day Legend',   icon: '🏆' },
];

/** 当前连续打卡天数（Loop 宽容算法：今日未打卡不立即清零昨日连续） */
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

/**
 * 计算本自然周（周一起）的打卡次数
 * 参考 Loop Habit Tracker Frequency 计算逻辑
 */
export function calcWeeklyProgress(checkIns: string[]): number {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  let done = 0;
  for (let i = 0; i <= 6; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - mondayOffset + i);
    if (checkIns.includes(toDateKey(d))) done++;
  }
  return done;
}

/** 30天完成率（Loop 参考：habit score） */
export function calcCompletionRate(checkIns: string[], days = 30): number {
  const today = new Date();
  let count = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (checkIns.includes(toDateKey(d))) count++;
  }
  return Math.round((count / days) * 100);
}

/** 获取当前连续对应的最高里程碑 */
export function getCurrentMilestone(streak: number): Milestone | null {
  const ms = [...MILESTONES].reverse().find(m => streak >= m.days);
  return ms ?? null;
}

/** 获取刚达成但未展示的里程碑（用于庆祝弹出） */
export function getNewMilestone(streak: number, shown: number[]): Milestone | null {
  return MILESTONES.find(m => streak >= m.days && !shown.includes(m.days)) ?? null;
}

export function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * 智能识别习惯名称中的时间关键词，返回建议提醒时间
 * 参考 Habitica 的场景分类，扩展为中文关键词匹配
 */
export function suggestReminderTime(name: string): string | null {
  const n = name.toLowerCase();
  if (/早起|早上|早晨|起床|晨练|晨跑/.test(n)) return '07:00';
  if (/午饭|午餐|中午|午休/.test(n))             return '12:00';
  if (/下午|午后/.test(n))                       return '15:00';
  if (/晚饭|傍晚|晚餐/.test(n))                  return '18:30';
  if (/睡前|入睡|就寝|睡觉|晚上|夜晚|夜间/.test(n)) return '22:00';
  if (/运动|锻炼|健身|跑步|瑜伽/.test(n))         return '18:00';
  if (/读书|阅读|学习/.test(n))                  return '21:00';
  return null;
}

// ─── Store ────────────────────────────────────────────────────────────────────
interface HabitState {
  habits: Habit[];
  addHabit: (name: string, color: HabitColor, reminderTime?: string, note?: string, frequency?: 'daily' | 'flexible', weeklyTarget?: number) => void;
  removeHabit: (id: string) => void;
  updateHabit: (id: string, updates: Partial<Pick<Habit, 'name' | 'color' | 'reminderEnabled' | 'reminderTime' | 'note' | 'frequency' | 'weeklyTarget'>>) => void;
  toggleCheckIn: (id: string, date: string) => void;
  markMilestoneShown: (id: string, days: number) => void;
}

export const useHabitStore = create<HabitState>()(
  persist(
    (set) => ({
      habits: [],

      addHabit: (name, color, reminderTime = '', note = '', frequency = 'daily', weeklyTarget = 3) =>
        set((s) => ({
          habits: [
            ...s.habits,
            {
              id: crypto.randomUUID(),
              name,
              color,
              createdAt: new Date().toISOString(),
              checkIns: [],
              reminderEnabled: reminderTime !== '',
              reminderTime,
              note,
              milestonesShown: [],
              frequency,
              weeklyTarget,
      