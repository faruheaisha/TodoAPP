import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from './store/settingsStore';
import { useTodoStore } from './store/todoStore';
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
    theme, language,
    startupDelay, reminderIgnored, lastPromptDate, setLastPromptDate,
    achievementTime, achievementLastDate, setAchievementLastDate,
  } = useSettingsStore();
  const { todos, isLoading, setTodos } = useTodoStore();
  const [filter, setFilter] = useState<FilterType>('all');

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Apply language
  useEffect(() => {
    if (language && i18n && i18n.changeLanguage) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  // 开机弹窗提醒 — 真正按用户在设置中配置的「开机弹窗延迟」(分钟) 调度系统通知，
  // 而不是依赖后端写死的固定时长。每天最多提醒一次，且尊重用户的「不再提醒」选择。
  // 说明：原 Rust 端 setup() 中也会在固定 5 分钟后 emit("startup-prompt")，
  // 但前端从未监听过该事件 —— 该机制实际上从未生效。这里改为完全由前端
  // 按用户设置调度，确保滑块的数值能真实影响提醒时机。
  useEffect(() => {
    if (reminderIgnored) return;
    const todayStr = new Date().toISOString().split('T')[0];
    if (lastPromptDate === todayStr) return; // 今天已经提醒过，避免重复打扰

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
  // 规则：
  //   1. achievementTime 为空 → 关闭
  //   2. 今天已弹过 (achievementLastDate === today) → 跳过
  //   3. 当前时间 < 设定时间 → 倒计时到设定时间再弹
  //   4. 当前时间 >= 设定时间 && 今天未弹 → 立即弹（应用在成就时间后启动的场景）
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

    if (diffMs <= 0) {
      // 已过今日成就时间，立即弹
      dispatch();
      return;
    }

    const timer = setTimeout(dispatch, diffMs);
    return () => clearTimeout(timer);
  }, [achievementTime, achievementLastDate, setAchievementLastDate]);

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
  const hasCompletedTodos = todos.filter(t => t.completed).length > 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{
      backgroundColor: 'var(--color-bg-primary)',
      color: 'var(--color-text-primary)',
    }}>
      <Header />
      {/* 输入框常驻可见 */}
      <AddTodoBar />
      {/* 过滤 Tab — 仅当有任务时显示 */}
      {hasTodos && (
        <FilterTabs
          activeFilter={filter}
          onFilterChange={setFilter}
        />
      )}
      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {!hasTodos && !isLoading ? (
          <EmptyState />
        ) : (
          <div className="px-5 pt-2 pb-6">
            <TodoSection filter={filter} />
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
