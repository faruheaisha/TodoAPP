/**
 * contextInjector.ts — 自动上下文注入
 *
 * 构建隐私过滤后的 app 全景摘要，注入到 cowork 模式的系统提示中。
 * 只读 DOMAIN_CLASSIFICATIONS[x].publicFields 中声明的字段，
 * tool_only / sensitive / restricted 字段一律跳过。
 */
import { useTodoStore } from '../../store/todoStore';
import { useFocusStore } from '../../store/focusStore';
import { useHabitStore, calcStreak, calcWeeklyProgress } from '../../store/habitStore';
import { useNotesStore } from '../../store/notesStore';
import { useMusicLibraryStore } from '../../store/musicLibraryStore';
import { isInTodayView, isOverdue, localDateKey } from '../utils';
import type { Todo } from '../../store/todoStore';

/** 获取今天/本周完成的任务数 */
function weekCompleted(todos: Todo[]): number {
  const weekAgo = Date.now() - 7 * 86400000;
  return todos.filter((t) => t.completed && new Date(t.createdAt).getTime() >= weekAgo).length;
}

/** 任务上下文块 */
function buildTodoBlock(lang: 'zh' | 'en'): string[] {
  const todos = useTodoStore.getState().todos;
  const lines: string[] = [];
  const active = todos.filter((t) => !t.completed);
  const todayTodos = todos.filter(isInTodayView);
  const overdue = todos.filter((t) => !t.completed && isOverdue(t));
  const doneWeek = weekCompleted(todos);

  // 统计摘要
  if (lang === 'zh') {
    lines.push(`📋 任务：${active.length} 个进行中，${todayTodos.length} 个今日到期/逾期，本周完成 ${doneWeek} 个`);
  } else {
    lines.push(`📋 Todos: ${active.length} active, ${todayTodos.length} due/overdue today, ${doneWeek} completed this week`);
  }

  // 逾期任务
  if (overdue.length > 0) {
    const items = overdue.slice(0, 5).map((t) => {
      const days = Math.ceil((Date.now() - new Date(t.deadline!).getTime()) / 86400000);
      return `"${t.title}"（${lang === 'zh' ? `超期 ${days} 天` : `${days}d overdue`}）`;
    });
    lines.push(`  ${lang === 'zh' ? '逾期' : 'Overdue'}：${items.join('、')}`);
    if (overdue.length > 5) lines.push(`  ${lang === 'zh' ? `…还有 ${overdue.length - 5} 个` : `…and ${overdue.length - 5} more`}`);
  }

  // 今日任务
  const todayDue = todayTodos.filter((t) => !isOverdue(t));
  if (todayDue.length > 0) {
    const items = todayDue.slice(0, 8).map((t) =>
      `"${t.title}"${t.priority > 1 ? ` [P${4 - t.priority}]` : ''}`
    );
    lines.push(`  ${lang === 'zh' ? '今日' : 'Today'}：${items.join('、')}`);
    if (todayDue.length > 8) lines.push(`  ${lang === 'zh' ? `…还有 ${todayDue.length - 8} 个` : `…and ${todayDue.length - 8} more`}`);
  }

  // 快速任务（无截止时间）
  const quick = active.filter((t) => t.todoType === 'quick');
  if (quick.length > 0) {
    lines.push(`  ${lang === 'zh' ? `无截止时间：${quick.length} 个快速任务` : `No deadline: ${quick.length} quick todos`}`);
  }

  return lines;
}

/** 习惯上下文块 */
function buildHabitBlock(lang: 'zh' | 'en'): string[] {
  const habits = useHabitStore.getState().habits;
  const lines: string[] = [];
  if (habits.length === 0) {
    lines.push(lang === 'zh' ? '🏋️ 习惯：暂无' : '🏋️ Habits: none');
    return lines;
  }
  const header = lang === 'zh'
    ? `🏋️ 习惯：${habits.length} 项`
    : `🏋️ Habits: ${habits.length} tracked`;
  lines.push(header);
  habits.slice(0, 6).forEach((h) => {
    const streak = calcStreak(new Set(h.checkIns));
    const weekly = calcWeeklyProgress(h.checkIns);
    if (lang === 'zh') {
      lines.push(`  - "${h.name}" — 连续 ${streak} 天，本周 ${weekly}/${h.weeklyTarget}`);
    } else {
      lines.push(`  - "${h.name}" — ${streak}-day streak, ${weekly}/${h.weeklyTarget} this week`);
    }
  });
  if (habits.length > 6) {
    lines.push(lang === 'zh' ? `  …还有 ${habits.length - 6} 项` : `  …and ${habits.length - 6} more`);
  }
  return lines;
}

/** 专注上下文块 */
function buildFocusBlock(lang: 'zh' | 'en'): string[] {
  const focus = useFocusStore.getState();
  const today = localDateKey();
  const todayMin = focus.dailyFocusMinutes[today] ?? 0;
  if (focus.completedWorkSessions === 0 && todayMin === 0) {
    return [lang === 'zh' ? '🍅 专注：今日暂无' : '🍅 Focus: none today'];
  }
  const mins = Math.round(todayMin);
  if (lang === 'zh') {
    return [`🍅 专注：今日 ${focus.completedWorkSessions} 个番茄，共 ${mins} 分钟`];
  }
  return [`🍅 Focus: ${focus.completedWorkSessions} pomodoros today, ${mins} min total`];
}

/** 笔记上下文块 */
function buildNotesBlock(lang: 'zh' | 'en'): string[] {
  const notes = useNotesStore.getState();
  const scratchLen = notes.scratchpad.length;
  if (scratchLen === 0 && Object.keys(notes.todoNotes).length === 0) {
    return [lang === 'zh' ? '📝 笔记：暂无' : '📝 Notes: none'];
  }
  if (lang === 'zh') {
    const parts: string[] = [];
    if (scratchLen > 0) parts.push(`随手记 ${scratchLen} 字`);
    const noteCount = Object.keys(notes.todoNotes).filter((k) => notes.todoNotes[k].length > 0).length;
    if (noteCount > 0) parts.push(`${noteCount} 个任务有笔记`);
    return [`📝 笔记：${parts.join('，')}`];
  }
  const parts: string[] = [];
  if (scratchLen > 0) parts.push(`scratchpad (${scratchLen} chars)`);
  const noteCount = Object.keys(notes.todoNotes).filter((k) => notes.todoNotes[k].length > 0).length;
  if (noteCount > 0) parts.push(`${noteCount} todos with notes`);
  return [`📝 Notes: ${parts.join(', ')}`];
}

/** 音乐库上下文块 */
function buildMusicBlock(lang: 'zh' | 'en'): string[] {
  const { tracks, categories } = useMusicLibraryStore.getState();
  if (tracks.length === 0) {
    return [lang === 'zh' ? '🎵 音乐库：暂无' : '🎵 Music: none'];
  }
  if (lang === 'zh') {
    return [`🎵 音乐库：${tracks.length} 首，${categories.length} 个分类`];
  }
  return [`🎵 Music: ${tracks.length} tracks, ${categories.length} categories`];
}

/**
 * buildAppContext — 构建隐私过滤后的 app 上下文摘要
 *
 * 仅在 cowork 模式下调用，结果拼接到系统提示末尾。
 * 严格遵守 DOMAIN_CLASSIFICATIONS 中的 publicFields 声明。
 * 不包含：API Key、文件路径、备份凭据、笔记全文、习惯打卡细节。
 */
export function buildAppContext(lang: 'zh' | 'en'): string {
  const blocks: string[] = [];
  blocks.push(lang === 'zh' ? '当前应用状态：' : 'Current app state:');
  blocks.push(...buildTodoBlock(lang));
  blocks.push(...buildHabitBlock(lang));
  blocks.push(...buildFocusBlock(lang));
  blocks.push(...buildNotesBlock(lang));
  blocks.push(...buildMusicBlock(lang));
  return blocks.join('\n');
}
