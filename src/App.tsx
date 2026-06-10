import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from './store/settingsStore';
import { useTodoStore } from './store/todoStore';
import { useTagStore } from './store/tagStore';
import { useCompletionStore } from './store/completionStore';
import { useHabitStore } from './store/habitStore';
import { calcWeeklyStats, buildReportText, msUntilNext } from './lib/weeklyReport';
import { TagChip } from './components/TagChip';
import { initDB, loadTodos } from './lib/tauri';

import './i18n';
import './styles/globals.css';

import Header from './components/Header';
import AddTodoBar from './components/AddTodoBar';
import FilterTabs, { type FilterType } from './components/FilterTabs';
import TodoSection from './components/TodoSection';
import EmptyState from './components/EmptyState';
import SettingsDrawer from './components/SettingsDrawer';
import ToolsPanel from './components/ToolsPanel';
import { DailyAchievementModal } from './components/DailyAchievementModal';

function App() {
  const { t, i18n } = useTranslation();
  const {
    theme, language, accentColor,
    startupDelay, reminderIgnored, lastPromptDate, setLastPromptDate,
    achievementTime, achievementLastDate, setAchievementLastDate,
    weeklyReportEnabled, weeklyReportDay, weeklyReportTime, weeklyReportLastDate, setWeeklyReportLastDate,
  } = useSettingsStore();
  const { todos, isLoading, setTodos } = useTodoStore();
  const { tags } = useTagStore();
  const completionTimes = useCompletionStore((s) => s.completionTimes);
  const habits = useHabitStore((s) => s.habits);
  const [filter, setFilter] = useState<FilterType>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Apply accent color
  useEffect(() => {
    if (accentColor && accentColor !== 'coral') {
      document.documentElement.setAttribute('data-accent', accentColor);
    } else {
      document.documentElement.removeAttribute('data-accent');
    }
  }, [accentColor]);

  // Apply language
  useEffect(() => {
    if (language && i18n && i18n.changeLanguage) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  // 开机弹窗提醒
  useEffect(() => {
    if (reminderIgnored) return;
    const todayStr = new Date().toISOString().split('T')[0];
    if (lastPromptDate === todayStr) return;

    const delayMs = Math.max(1, startupDelay) * 60 * 1000;
    const timer = setTimeout(async () => {
      try {
        const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
        let granted = await isPermissionGranted();
        if (!granted) {
          const permission = await requestPermission();
          granted = permission === 'granted';
        }
        if (granted) {
          sendNotification({
            title: t('notifications.startup.title'),
            body: t('notifications.startup.body'),
          });
        }
      } catch (e) {
        console.warn('Startup prompt notification skipped:', e);
      } finally {
        setLastPromptDate(todayStr);
      }
    }, delayMs);
    return () => clearTimeout(timer);
  }, [startupDelay, reminderIgnored, lastPromptDate, setLastPromptDate, t]);

  // 每日成就弹窗调度
  useEffect(() => {
    if (!achievementTime) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    if (achievementLastDate === todayKey) return;

    const [hh, mm] = achievementTime.split(':').map(Number);
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
    const diffMs = target.getTime() - now.getTime();

    const dispatch = () => {
      window.dispatchEvent(new CustomEvent('show-achievement'));
      setAchievementLastDate(todayKey);
    };

    if (diffMs <= 0) { dispatch(); return; }
    const timer = setTimeout(dispatch, diffMs);
    return () => clearTimeout(timer);
  }, [achievementTime, achievementLastDate, setAchievementLastDate]);


  // 每周成就报告通知
  useEffect(() => {
    if (!weeklyReportEnabled) return;

    // 计算本周报告周期键（当周的 ISO 周，格式 YYYY-WNN）
    const getWeekKey = () => {
      const now = new Date();
      const jan1 = new Date(now.getFullYear(), 0, 1);
      const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
      return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
    };

    const weekKey = getWeekKey();
    // 本周已发过则跳过
    if (weeklyReportLastDate === weekKey) return;

    const delayMs = msUntilNext(weeklyReportDay, weeklyReportTime);
    const timer = setTimeout(async () => {
      try {
        const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
        let granted = await isPermissionGranted();
        if (!granted) {
          const perm = await requestPermission();
          granted = perm === 'granted';
        }
        if (granted) {
          const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
          const stats = calcWeeklyStats(completionTimes, habits);
          const { title, body } = buildReportText(stats, lang);
          sendNotification({ title, body });
        }
      } catch (e) {
        console.warn('Weekly report notification skipped:', e);
      } finally {
        setWeeklyReportLastDate(getWeekKey());
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [weeklyReportEnabled, weeklyReportDay, weeklyReportTime, weeklyReportLastDate,
      completionTimes, habits, i18n.language, setWeeklyReportLastDate]);


  // 截止提醒通知 — 每小时扫描一次，每条 todo 每天最多推送一次
  // 参考 TickTick 的 deadline alert 策略：urgent（24h内）+ overdue（已过期）各推一次
  const notifiedRef = React.useRef<Map<string, string>>(new Map()); // todoId → lastNotifiedDate

  useEffect(() => {
    const scan = async () => {
      const todayKey = new Date().toISOString().slice(0, 10);
      const now = new Date();

      // 找出需要提醒的 todos
      const targets = todos.filter(todo => {
        if (todo.completed || !todo.deadline) return false;
        const lastNotified = notifiedRef.current.get(todo.id);
        if (lastNotified === todayKey) return false; // 今天已推送过

        const deadline = new Date(todo.deadline);
        const diffMs = deadline.getTime() - now.getTime();
        const diffHours = diffMs / 3600000;

        // overdue 或 24h 内截止
        return diffMs < 0 || diffHours <= 24;
      });

      if (targets.length === 0) return;

      try {
        const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
        let granted = await isPermissionGranted();
        if (!granted) {
          const perm = await requestPermission();
          granted = perm === 'granted';
        }
        if (!granted) return;

        const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
        for (const todo of targets) {
          const deadline = new Date(todo.deadline!);
          const diffMs = deadline.getTime() - now.getTime();
          const isOverdue = diffMs < 0;

          const title = isOverdue
            ? (lang === 'zh' ? '⚠️ 任务已过期' : '⚠️ Task Overdue')
            : (lang === 'zh' ? '⏰ 任务即将截止' : '⏰ Task Due Soon');

          const timeStr = deadline.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          });

          const body = lang === 'zh'
            ? `${todo.title}  ·  ${isOverdue ? '已过期：' : '截止：'}${timeStr}`
            : `${todo.title}  ·  ${isOverdue ? 'Overdue: ' : 'Due: '}${timeStr}`;

          sendNotification({ title, body });
          notifiedRef.current.set(todo.id, todayKey);
        }
      } catch (e) {
        console.warn('Deadline reminder skipped:', e);
      }
    };

    // 立即扫描一次，然后每小时扫描
    scan();
    const interval = setInterval(scan, 3600000);
    return () => clearInterval(interval);
  }, [todos, i18n.language]);

  // Load todos on mount
  useEffect(() => {
    async function init() {
      try {
        await initDB();
        const data = await loadTodos();
        setTodos(data);
      } catch (e) {
        console.error('Failed to initialize app:', e);
      }
    }
    init();
  }, []);

  const hasTodos = todos.length > 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{
      backgroundColor: 'var(--color-bg-primary)',
      color: 'var(--color-text-primary)',
    }}>
      <Header />
      <AddTodoBar />
      {hasTodos && (
        <FilterTabs activeFilter={filter} onFilterChange={setFilter} />
      )}

      {/* 标签过滤栏 — 有标签时显示 */}
      {tags.length > 0 && (
        <div
          className="flex-shrink-0 flex items-center flex-wrap"
          style={{
            padding: '5px 14px',
            gap: '5px',
            borderBottom: '0.5px solid var(--color-separator)',
            backgroundColor: 'var(--color-bg-primary)',
          }}
        >
          {/* 全部 chip */}
          <button
            onClick={() => setActiveTag(null)}
            className="flex items-center transition-colors cursor-pointer"
            style={{
              height: '20px', padding: '0 8px', borderRadius: '10px', fontSize: '10px',
              border: '0.5px solid', fontWeight: 500,
              borderColor: activeTag === null ? 'var(--clay)' : 'var(--color-border)',
              backgroundColor: activeTag === null ? 'var(--clay-light)' : 'transparent',
              color: activeTag === null ? 'var(--clay)' : 'var(--color-text-tertiary)',
            }}
          >
            全部
          </button>
          {tags.map(tag => (
            <TagChip
              key={tag.id}
              tag={tag}
              size="xs"
              active={activeTag === tag.id}
              onClick={() => setActiveTag(activeTag === tag.id ? null : tag.id)}
            />
          ))}
        </div>
      )}

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {!hasTodos && !isLoading ? (
          <EmptyState />
        ) : (
          <div className="px-5 pt-2 pb-6">
            <TodoSection filter={filter} tagFilter={activeTag} />
          </div>
        )}
      </div>
      <SettingsDrawer />
      <ToolsPanel />
      <DailyAchievementModal />
    </div>
  );
}

export default App;
