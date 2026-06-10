import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from './store/settingsStore';
import { useTodoStore } from './store/todoStore';
import { useTagStore } from './store/tagStore';
import { useCompletionStore } from './store/completionStore';
import { useHabitStore } from './store/habitStore';
import { calcWeeklyStats, buildReportText, msUntilNext } from './lib/weeklyReport';
import { useOverlayStore } from './store/overlayStore';
import { usePrefersDark } from './lib/responsive';

const FocusLockScreen = lazy(() => import('./windows/FocusLockScreen'));
const ClockScreen = lazy(() => import('./windows/ClockScreen'));
// 非首屏组件懒加载：减小首屏 bundle，缩短冷启动白屏时间
const SettingsDrawer = lazy(() => import('./components/SettingsDrawer'));
const ToolsPanel = lazy(() => import('./components/ToolsPanel'));
const DailyAchievementModal = lazy(() =>
  import('./components/DailyAchievementModal').then((m) => ({ default: m.DailyAchievementModal }))
);
import { TagChip } from './components/TagChip';
import { initDB, loadTodos } from './lib/tauri';

import './i18n';
import './styles/globals.css';

import Header from './components/Header';
import AddTodoBar from './components/AddTodoBar';
import FilterTabs, { type FilterType } from './components/FilterTabs';
import TodoSection from './components/TodoSection';
import EmptyState from './components/EmptyState';

function App() {
  const { t, i18n } = useTranslation();
  const {
    theme, language, accentColor, hotkey,
    startupDelay, reminderIgnored, lastPromptDate, setLastPromptDate,
    achievementTime, achievementLastDate, setAchievementLastDate,
    weeklyReportEnabled, weeklyReportDay, weeklyReportTime, weeklyReportLastDate, setWeeklyReportLastDate,
  } = useSettingsStore();
  const { todos, isLoading, setTodos } = useTodoStore();
  const { tags } = useTagStore();
  const completionTimes = useCompletionStore((s) => s.completionTimes);
  const habits = useHabitStore((s) => s.habits);
  const { focusLock, clock } = useOverlayStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // 主题解析：theme='system' 时跟随系统/手机日夜模式实时切换
  const prefersDark = usePrefersDark();
  const resolvedTheme = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;

  // Apply theme + 同步移动端浏览器外壳 theme-color
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolvedTheme === 'dark' ? '#1a1a18' : '#faf9f5');
  }, [resolvedTheme]);

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

  // 全局快捷键：注册 settings 中的 hotkey，按下时切换主窗口显示/隐藏
  useEffect(() => {
    if (!hotkey) return;
    let active = true;
    let registeredKey: string | null = null;

    (async () => {
      try {
        const { register, unregister, isRegistered } = await import('@tauri-apps/plugin-global-shortcut');
        if (await isRegistered(hotkey)) await unregister(hotkey);
        if (!active) return;
        await register(hotkey, async (event) => {
          if (event.state !== 'Pressed') return;
          try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();
            const visible = await win.isVisible();
            const focused = await win.isFocused();
            if (visible && focused) {
              await win.hide();
            } else {
              await win.show();
              await win.setFocus();
            }
          } catch (err) {
            console.warn('Hotkey toggle failed:', err);
          }
        });
        registeredKey = hotkey;
      } catch (e) {
        console.warn('Global shortcut registration failed:', e);
      }
    })();

    return () => {
      active = false;
      if (registeredKey) {
        import('@tauri-apps/plugin-global-shortcut')
          .then(({ unregister }) => unregister(registeredKey!))
          .catch(() => {});
      }
    };
  }, [hotkey]);

  // 无闪启动：窗口初始 visible:false（tauri.conf.json），首帧渲染完成后再显示
  useEffect(() => {
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        if (cancelled) return;
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const win = getCurrentWindow();
          await win.show();
          await win.setFocus();
        } catch { /* 非 Tauri 环境（浏览器调试）忽略 */ }
      });
    });
    return () => { cancelled = true; };
  }, []);

  const hasTodos = todos.length > 0;

  return (
    <div className="app-shell flex flex-col overflow-hidden" style={{
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
      <Suspense fallback={null}>
        <SettingsDrawer />
        <ToolsPanel />
        <DailyAchievementModal />
        {/* Full-screen overlays */}
        {focusLock && <FocusLockScreen />}
        {clock && <ClockScreen />}
      </Suspense>
    </div>
  );
}

export default App;
