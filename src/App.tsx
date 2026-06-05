import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from './store/settingsStore';
import { useTodoStore } from './store/todoStore';
import { initDB, loadTodos } from './lib/tauri';

import './i18n';
import './styles/globals.css';

import Header from './components/Header';
import AddTodoBar from './components/AddTodoBar';
import FilterTabs from './components/FilterTabs';
import TodoSection from './components/TodoSection';
import EmptyState from './components/EmptyState';
import SettingsDrawer from './components/SettingsDrawer';

function App() {
  const { t, i18n } = useTranslation();
  const { theme, language } = useSettingsStore();
  const { todos, isLoading, setTodos } = useTodoStore();

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
      {/* 输入框常驻可见 — P0 修复 */}
      <AddTodoBar />
      {/* 过滤 Tab — 任务 > 5 条时决定性地提升效率 */}
      {hasTodos && <FilterTabs />}
      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {!hasTodos && !isLoading ? (
          <EmptyState />
        ) : (
          <div className="px-5 pt-2 pb-6">
            <TodoSection />
          </div>
        )}
      </div>
      <SettingsDrawer />
    </div>
  );
}

export default App;