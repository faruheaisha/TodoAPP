import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTodoStore } from '../store/todoStore';
import { useRecurrenceStore, RECURRENCE_OPTIONS, type RecurrenceType } from '../store/recurrenceStore';
import { Plus, Calendar, Repeat } from 'lucide-react';

export default function AddTodoBar() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const { addTodo } = useTodoStore();
  const { setRule } = useRecurrenceStore();
  const [title, setTitle] = useState('');
  const [todoType, setTodoType] = useState<'quick' | 'longterm'>('quick');
  const [deadline, setDeadline] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType | ''>('');
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);
  const deadlineInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return;
    const effectiveDeadline = todoType === 'longterm' && deadline ? deadline : null;
    await addTodo(title.trim(), todoType, effectiveDeadline).catch(console.error);
    // 新建后找到最后一条（就是刚加入的），绑定重复规则
    if (recurrence) {
      const { useTodoStore: store } = await import('../store/todoStore');
      const todos = store.getState().todos;
      const latest = [...todos].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      if (latest) setRule(latest.id, { type: recurrence });
    }
    setTitle('');
    setDeadline('');
    setRecurrence('');
    setShowRecurrencePicker(false);
  }, [title, todoType, deadline, recurrence, addTodo, setRule]);

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
        <div className="mt-1.5" style={{ position: 'relative' }}>
          <div
            onClick={() => deadlineInputRef.current?.showPicker?.()}
            className="flex items-center cursor-pointer transition-colors"
            style={{
              height: '28px',
              padding: '0 10px',
              borderRadius: '5px',
              border: '0.5px solid ' + (deadline ? 'var(--clay)' : 'var(--color-border)'),
              backgroundColor: 'var(--color-bg-input)',
              gap: '7px',
              userSelect: 'none',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = deadline ? 'var(--clay)' : 'var(--color-border-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = deadline ? 'var(--clay)' : 'var(--color-border)';
            }}
          >
            <Calendar size={12} style={{ color: deadline ? 'var(--clay)' : 'var(--color-text-tertiary)', flexShrink: 0 }} />
            <span
              className="text-xs flex-1"
              style={{ color: deadline ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}
            >
              {deadline
                ? new Date(deadline).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : t('app.deadline')}
            </span>
            {deadline && (
              <button
                onClick={(e) => { e.stopPropagation(); setDeadline(''); }}
                className="flex items-center justify-center"
                style={{
                  width: '14px', height: '14px', borderRadius: '50%',
                  backgroundColor: 'var(--color-bg-tertiary)',
                  border: 'none', cursor: 'pointer', flexShrink: 0,
                  color: 'var(--color-text-tertiary)', fontSize: '10px', lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </div>
          <input
            ref={deadlineInputRef}
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: 0, height: 0, opacity: 0,
              pointerEvents: 'none', border: 'none',
            }}
            tabIndex={-1}
          />
        </div>
      )}

      {/* 重复规则选择器 */}
      <div className="mt-1.5 flex items-center" style={{ gap: '6px', position: 'relative' }}>
        <button
          onClick={() => setShowRecurrencePicker((v) => !v)}
          className="flex items-center transition-colors cursor-pointer"
          style={{
            height: '24px', padding: '0 9px', gap: '5px',
            borderRadius: '5px', border: '0.5px solid',
            borderColor: recurrence ? 'var(--clay)' : 'var(--color-border)',
            backgroundColor: recurrence ? 'var(--clay-light)' : 'transparent',
            fontSize: '10px', color: recurrence ? 'var(--clay)' : 'var(--color-text-tertiary)',
          }}
        >
          <Repeat size={10} />
          {recurrence
            ? (RECURRENCE_OPTIONS.find(o => o.type === recurrence)?.[lang === 'zh' ? 'labelZh' : 'labelEn'] ?? recurrence)
            : (lang === 'zh' ? '不重复' : 'No repeat')}
        </button>

        {showRecurrencePicker && (
          <div
            className="absolute flex flex-col overflow-hidden"
            style={{
              top: '26px', left: 0, zIndex: 100,
              borderRadius: '7px', border: '0.5px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-primary)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
              minWidth: '120px',
            }}
          >
            <button
              onClick={() => { setRecurrence(''); setShowRecurrencePicker(false); }}
              className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition-colors"
              style={{ color: !recurrence ? 'var(--clay)' : 'var(--color-text-secondary)', backgroundColor: 'transparent', border: 'none', textAlign: 'left' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              {lang === 'zh' ? '不重复' : 'No repeat'}
            </button>
            {RECURRENCE_OPTIONS.map(opt => (
              <button
                key={opt.type}
                onClick={() => { setRecurrence(opt.type); setShowRecurrencePicker(false); }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition-colors"
                style={{ color: recurrence === opt.type ? 'var(--clay)' : 'var(--color-text-secondary)', backgroundColor: 'transparent', border: 'none', textAlign: 'left' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                <span>{opt.icon}</span>
                {lang === 'zh' ? opt.labelZh : opt.labelEn}
              </button>
            ))}
          </div>
        )}
      </div>
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
