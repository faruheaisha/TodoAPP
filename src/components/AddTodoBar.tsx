import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTodoStore } from '../store/todoStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';

export default function AddTodoBar() {
  const { t } = useTranslation();
  const { addTodo } = useTodoStore();
  const [title, setTitle] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [todoType, setTodoType] = useState<'quick' | 'longterm'>('quick');
  const [deadline, setDeadline] = useState('');

  const handleSubmit = useCallback(() => {
    if (!title.trim()) return;
    addTodo(title.trim(), todoType, todoType === 'longterm' && deadline ? deadline : null);
    setTitle('');
    setShowOptions(false);
    setDeadline('');
  }, [title, todoType, deadline, addTodo]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="mb-5">
      <div className="flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowOptions(true)}
          placeholder={t('app.addPlaceholder')}
          className="flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none transition-all focus:ring-1"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-input)',
            color: 'var(--color-text-primary)',
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border-hover)';
            e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-light)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        <button
          onClick={handleSubmit}
          className="rounded-xl border-none px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 flex items-center gap-1.5"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <Plus size={15} />
          <span>{t('app.addButton')}</span>
        </button>
      </div>

      {/* Options Panel */}
      <AnimatePresence>
        {showOptions && title.length === 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 px-1"
          >
            <div className="flex items-center gap-3">
              {/* Type Selector */}
              <div className="flex gap-1">
                <button
                  onClick={() => setTodoType('quick')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all border ${
                    todoType === 'quick' ? '' : ''
                  }`}
                  style={{
                    backgroundColor: todoType === 'quick' ? 'var(--color-accent)' : 'transparent',
                    color: todoType === 'quick' ? '#FAF9F7' : 'var(--color-text-secondary)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  {t('app.quick')}
                </button>
                <button
                  onClick={() => setTodoType('longterm')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all border`}
                  style={{
                    backgroundColor: todoType === 'longterm' ? 'var(--color-accent)' : 'transparent',
                    color: todoType === 'longterm' ? '#FAF9F7' : 'var(--color-text-secondary)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  {t('app.longterm')}
                </button>
              </div>

              {/* Deadline Picker (only for longterm) */}
              {todoType === 'longterm' && (
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="px-2 py-1 rounded-md text-xs border"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-bg-input)',
                    color: 'var(--color-text-secondary)',
                  }}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
