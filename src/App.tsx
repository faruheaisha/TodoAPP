import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from './store/settingsStore';
import { useTodoStore } from './store/todoStore';
import { useTagStore } from './store/tagStore';
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
    theme, language,
    startupDelay, reminderIgnored, lastPromptDate, setLastPromptDate,
    achievementTime, achievementLastDate, setAchievementLastDate,
  } = useSettingsStore();
  const { todos, isLoading, setTodos } = useTodoStore();
  const { tags } = useTagStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);

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
