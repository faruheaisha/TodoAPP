import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTodoStore } from '../store/todoStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';

export default function AddTodoBar() {
  const { t } = useTranslation();
  const { addTodo } = useTodoStore();
  const [title, setTitle] = useState('');
  const [todoType, setTodoType] = useState<'quick' | 'longterm'>('quick');
  const [deadline, setDeadline] = useState('');

  const handleSubmit = useCallback(() => {
    if (!title.trim()) return;
    addTodo(title.trim(), todoType, todoType === 'longterm' && deadline ? deadline : null);
    setTitle('');
    setDeadline('');
  }, [title, todoType, deadline, addTodo]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div
      className="px-5 pt-3 pb-1.5 border-b"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg-primary)',
      }}
    >
      <div className="flex gap-0">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`${t('app.addPlaceholder')} — 按 Enter 确认`}
          className="flex-1 px-4 py-2.5 text-sm outline-none transition-all"
          style={{
            backgroundColor: 'var(--color-bg-input)',
            color: 'var(--color-text-primary)',
            border: '0.5px solid var(--color-border)',
            borderRight: 'none',
            /* 非对称圆角 — Anthropic 风格：顶部平直，底部圆角 */
            borderRadius: '0 0 0 8px',
            transition: 'border-color 150ms ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border-hover)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
          }}
        />
        <button
          onClick={handleSubmit}
          className="px-5 py-2.5 text-sm font-semibold transition-all"
          style={{
            backgroundColor: 'var(--slate)',
            color: 'var(--ivory-light)',
            border: 'none',
            /* 非对称圆角 — 顶部平直，底部圆角 */
            borderRadius: '0 0 8px 0',
            cursor: 'pointer',
            letterSpacing: 'var(--tracking-normal)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--clay)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--slate)';
          }}
        >
          <Plus size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          {t('app.addButton')}
        </button>
      </div>

      {/* Type selector row */}
      <div className="flex items-center gap-3 mt-2 pb-0.5">
        <button
          onClick={() => setTodoType('quick')}
          className={`px-2.5 py-0.5 rounded text-xs font-medium transition-all border`}
          style={{
            backgroundColor: todoType === 'quick' ? 'var(--slate)' : 'transparent',
            color: todoType === 'quick' ? 'var(--ivory-light)' : 'var(--color-text-tertiary)',
            borderColor: todoType === 'quick' ? 'var(--slate)' : 'var(--color-border)',
          }}
        >
          {t('app.quick')}
        </button>
        <button
          onClick={() => setTodoType('longterm')}
          className="px-2.5 py-0.5 rounded text-xs font-medium transition-all border"
          style={{
            backgroundColor: todoType === 'longterm' ? 'var(--slate)' : 'transparent',
            color: todoType === 'longterm' ? 'var(--ivory-light)' : 'var(--color-text-tertiary)',
            borderColor: todoType === 'longterm' ? 'var(--slate)' : 'var(--color-border)',
          }}
        >
          {t('app.longterm')}
        </button>

        {todoType === 'longterm' && (
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="px-2 py-0.5 rounded text-xs border"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-input)',
              color: 'var(--color-text-secondary)',
            }}
          />
        )}
      </div>
    </div>
  );
}