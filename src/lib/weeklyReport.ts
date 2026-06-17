/**
 * weeklyReport — 每周成就报告生成器
 *
 * 参考：Habitica 周报 + Streaks iOS 每周总结通知格式
 */

import { toDateKey } from '../store/habitStore';

export interface WeeklyStats {
  todosCompleted: number;
  habitCheckIns: number;
  topHabitName: string | null;
  topHabitStreak: number;
  activeDays: number;   // 过去 7 天中有打卡/完成的天数
}

export function calcWeeklyStats(
  completionTimes: Record<string, string>,
  habits: { name: string; checkIns: string[] }[]
): WeeklyStats {
  const now = new Date();
  const keys7: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    keys7.push(toDateKey(d));
  }
  const keySet = new Set(keys7);

  // Todo 完成数
  const todosCompleted = Object.values(completionTimes).filter(ts => {
    const day = toDateKey(new Date(ts));
    return keySet.has(day);
  }).length;

  // 习惯打卡数 + 最高连续
  let habitCheckIns = 0;
  let topHabitName: string | null = null;
  let topHabitStreak = 0;

  for (const h of habits) {
    const weekCount = h.checkIns.filter(d => keySet.has(d)).length;
    habitCheckIns += weekCount;

    // 计算连续天数
    let streak = 0;
    for (let i = 0; i <= 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      if (h.checkIns.includes(toDateKey(d))) streak++;
      else break;
    }
    if (streak > topHabitStreak) {
      topHabitStreak = streak;
      topHabitName = h.name;
    }
  }

  // 活跃天数：有任何 todo 完成或习惯打卡的天数
  const activeDaySet = new Set<string>();
  for (const ts of Object.values(completionTimes)) {
    const d = toDateKey(new Date(ts));
    if (keySet.has(d)) activeDaySet.add(d);
  }
  for (const h of habits) {
    for (const d of h.checkIns) {
      if (keySet.has(d)) activeDaySet.add(d);
    }
  }

  return {
    todosCompleted,
    habitCheckIns,
    topHabitName,
    topHabitStreak,
    activeDays: activeDaySet.size,
  };
}

export function buildReportText(stats: WeeklyStats, lang: 'zh' | 'en'): { title: string; body: string } {
  if (lang === 'zh') {
    const title = '🏆 本周成就报告';
    const lines: string[] = [
      `✅ 完成任务 ${stats.todosCompleted} 项`,
      `🔥 习惯打卡 ${stats.habitCheckIns} 次`,
      `📅 活跃天数 ${stats.activeDays}/7`,
    ];
    if (stats.topHabitName && stats.topHabitStreak >= 3) {
      lines.push(`🥇 「${stats.topHabitName}」连续 ${stats.topHabitStreak} 天`);
    }
    if (stats.todosCompleted === 0 && stats.habitCheckIns === 0) {
      lines.push('💪 新的一周，加油！');
    }
    return { title, body: lines.join('　') };
  } else {
    const title = '🏆 Weekly Achievement Report';
    const lines: string[] = [
      `✅ ${stats.todosCompleted} tasks done`,
      `🔥 ${stats.habitCheckIns} habit check-ins`,
      `📅 Active ${stats.activeDays}/7 days`,
    ];
    if (stats.topHabitName && stats.topHabitStreak >= 3) {
      lines.push(`🥇 "${stats.topHabitName}" ${stats.topHabitStreak}-day streak`);
    }
    return { title, body: lines.join(' · ') };
  }
}

/** 计算距离下次 weekday（0=Sun…6=Sat）+ time（HH:MM）的毫秒数 */
export function msUntilNext(weekday: number, timeStr: string): number {
  const [hh, mm] = timeStr.split(':').map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);

  // 找下一个匹配的 weekday
  let daysAhead = (weekday - now.getDay() + 7) % 7;
  if (daysAhead === 0 && target <= now) daysAhead = 7;
  target.setDate(now.getDate() + daysAhead);

  return Math.max(0, target.getTime() - now.getTime());
}
