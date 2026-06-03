import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from './store/settingsStore';
import { useTodoStore } from './store/todoStore';
import { initDB, loadTodos } from './lib/tauri';

import './i18n';
import './styles/globals.css';

import Header from './components/Header';
import AddTodoBar from './components/AddTodoBar';
import TodoSection from './components/TodoSection';
import EmptyState from './components/EmptyState';
import SettingsDrawer from './components/SettingsDrawer';

function App() {
  const { t } = useTranslation();
  const { theme, language } = useSettingsStore();
  const { todos, isLoading, loadTodos: loadStoreTodos } = useTodoStore();
  const { isOpen: settingsOpen } = useSettingsStore();

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Apply language
  useEffect(() => {
    const { i18n } = require('react-i18next');
    if (language) {
      i18n.changeLanguage(language);
    }
  }, [language]);

  // Load todos on mount
  useEffect(() => {
    async function init() {
      await initDB();
      const data = await loadTodos();
      loadStoreTodos(data);
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
      {!hasTodos && !isLoading ? (
        <EmptyState />
      ) : (
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6">
          <AddTodoBar />
          <TodoSection />
        </div>
      )}
      <SettingsDrawer />
    </div>
  );
}

export default App;
