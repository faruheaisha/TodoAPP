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

function App() {
  const { t, i18n } = useTranslation();
  const { theme, language } = useSettingsStore();
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
    </div>
  );
}

export default App;
