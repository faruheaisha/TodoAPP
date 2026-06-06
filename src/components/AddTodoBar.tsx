import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTodoStore } from '../store/todoStore';
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
      className="px-5 pt-3 border-b"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg-primary)',
      }}
    >
      {/* 一行：类型选择 + 输入框 + 添加按钮 */}
      <div className="flex gap-0 items-stretch">
        {/* Type selector buttons — 左移进输入行 */}
        <div
          className="flex items-stretch rounded-l-lg overflow-hidden border-r-0"
          style={{
            border: '0.5px solid var(--color-border)',
            borderRight: 'none',
            borderTopLeftRadius: 'var(--radius-md)',
            borderBottomLeftRadius: 'var(--radius-md)',
          }}
        >
          <button
            onClick={() => setTodoType('quick')}
            className="px-3 py-2.5 text-xs font-medium transition-all border-r"
            style={{
              color: todoType === 'quick' ? 'var(--ivory-light)' : 'var(--color-text-tertiary)',
              backgroundColor: todoType === 'quick' ? 'var(--slate)' : 'transparent',
              borderColor: 'var(--color-border)',
              borderRight: '0.5px solid var(--color-border)',
            }}
          >
            {t('app.quick')}
          </button>
          <button
            onClick={() => setTodoType('longterm')}
            className="px-3 py-2.5 text-xs font-medium transition-all"
            style={{
              color: todoType === 'longterm' ? 'var(--ivory-light)' : 'var(--color-text-tertiary)',
              backgroundColor: todoType === 'longterm' ? 'var(--slate)' : 'transparent',
            }}
          >
            {t('app.longterm')}
          </button>
        </div>

        {/* Input */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`${t('app.addPlaceholder')} — Enter`}
          className="flex-1 px-4 py-2.5 text-sm outline-none transition-all"
          style={{
            backgroundColor: 'var(--color-bg-input)',
            color: 'var(--color-text-primary)',
            border: '0.5px solid var(--color-border)',
            borderRight: 'none',
            transition: 'border-color 150ms ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border-hover)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
          }}
        />

        {/* Add button — async radius bottom-right */}
        <button
          onClick={handleSubmit}
          className="px-5 py-2.5 text-sm font-semibold transition-all flex items-center gap-1.5"
          style={{
            backgroundColor: 'var(--slate)',
            color: 'var(--ivory-light)',
            border: 'none',
            borderRadius: '0 var(--radius-md) var(--radius-md) 0',
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
          <Plus size={15} />
          <span>{t('app.addButton')}</span>
        </button>
      </div>

      {/* Deadline picker row (only when longterm selected) */}
      {todoType === 'longterm' && (
        <div className="mt-2">
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="px-2.5 py-1.5 rounded-md text-xs border w-full"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-input)',
              color: 'var(--color-text-secondary)',
            }}
          />
        </div>
      )}
    </div>
  );
}