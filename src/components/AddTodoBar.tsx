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
    addTodo(title.trim(), todoType, todoType === 'longterm' && deadline ? deadline : null)
      .catch(console.error);
    setTitle('');
    setDeadline('');
  }, [title, todoType, deadline, addTodo]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div
      className="border-b flex-shrink-0"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg-primary)',
        padding: '7px 14px',
      }}
    >
      <div className="flex items-stretch" style={{ gap: 0, height: 'var(--input-row-h)' }}>
        {/* Type selector */}
        <div
          className="flex items-stretch overflow-hidden flex-shrink-0"
          style={{
            border: '0.5px solid var(--color-border)',
            borderRight: 'none',
            borderRadius: '5px 0 0 5px',
          }}
        >
          <TypeBtn
            active={todoType === 'quick'}
            onClick={() => setTodoType('quick')}
          >
            <span className="type-btn-short" style={{ display: 'none' }}>{'⚡'}</span>
            <span className="type-btn-long">{t('app.quick')}</span>
          </TypeBtn>
          <TypeBtn
            active={todoType === 'longterm'}
            onClick={() => setTodoType('longterm')}
          >
            <span className="type-btn-short" style={{ display: 'none' }}>{'🗓'}</span>
            <span className="type-btn-long">{t('app.longterm')}</span>
          </TypeBtn>
        </div>

        {/* Input field */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('app.addPlaceholder') + ' ' + t('app.enterConfirm')}
            className="w-full h-full text-sm outline-none transition-colors"
            style={{
              backgroundColor: 'var(--color-bg-input)',
              color: 'var(--color-text-secondary)',
              border: '0.5px solid var(--color-border)',
              borderRight: 'none',
              borderLeft: 'none',
              padding: '5px 9px',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-hover)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
          />
        </div>

        {/* Add button */}
        <button
          onClick={handleSubmit}
          className="flex items-center justify-center font-medium transition-colors flex-shrink-0"
          style={{
            padding: '5px 12px',
            backgroundColor: 'var(--color-fill)',
            color: 'var(--color-fill-text)',
            border: 'none',
            borderRadius: '0 5px 5px 0',
            cursor: 'pointer',
            fontSize: '11px',
            gap: '4px',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--clay)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-fill)'; }}
        >
          <Plus size={15} />
          <span className="add-btn-text">{t('app.addButton')}</span>
        </button>
      </div>

      {/* Deadline picker */}
      {todoType === 'longterm' && (
        <div className="mt-1.5">
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full px-2.5 py-1 rounded text-xs border"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-input)',
              color: 'var(--color-text-secondary)',
              height: '26px',
            }}
          />
        </div>
      )}
    </div>
  );
}

function TypeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="font-medium transition-colors"
      style={{
        padding: '5px 9px',
        fontSize: '11px',
        border: 'none',
        borderRight: '0.5px solid var(--color-border)',
        color: active ? 'var(--color-fill-text)' : 'var(--color-text-tertiary)',
        backgroundColor: active ? 'var(--color-fill)' : 'transparent',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
