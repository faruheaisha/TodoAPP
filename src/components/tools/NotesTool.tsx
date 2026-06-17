/**
 * NotesTool — 快速笔记（P2.3）
 *
 * 上：随手记 scratchpad（打开即写，自动保存）
 * 下：任务笔记 —— TodoCombobox 选择任务后编辑关联备注
 * 纯 textarea + 自动保存（评估过 tiptap，为包体与离线一致性刻意从简）。
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StickyNote, Link2, Check } from 'lucide-react';
import { useNotesStore } from '../../store/notesStore';
import { useTodoStore } from '../../store/todoStore';
import { TodoCombobox } from '../TodoCombobox';

/** 自动保存指示：输入后短暂显示「已保存」 */
function useSavedFlash(): [boolean, () => void] {
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = () => {
    if (timer.current) clearTimeout(timer.current);
    setSaved(true);
    timer.current = setTimeout(() => setSaved(false), 1200);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return [saved, flash];
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  resize: 'none',
  outline: 'none',
  fontSize: '14px',
  lineHeight: 1.7,
  padding: '10px 12px',
  borderRadius: '8px',
  border: '0.5px solid var(--color-border)',
  backgroundColor: 'var(--color-bg-input)',
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-family)',
  transition: 'border-color var(--transition-fast)',
};

export function NotesTool() {
  const { t } = useTranslation();
  const { scratchpad, todoNotes, setScratchpad, setTodoNote } = useNotesStore();
  const todos = useTodoStore((s) => s.todos);
  const activeTodos = todos.filter((todo) => !todo.completed);

  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const selectedTodo = activeTodos.find((todo) => todo.id === selectedTodoId) ?? null;

  const [scratchSaved, flashScratch] = useSavedFlash();
  const [noteSaved, flashNote] = useSavedFlash();

  return (
    <div className="flex flex-col" style={{ gap: '18px' }}>
      {/* 随手记 */}
      <section className="flex flex-col" style={{ gap: '8px' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: '6px', marginLeft: '-15px' }}>
            <StickyNote size={14} style={{ color: 'var(--color-text-tertiary)' }} />
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}>
              {t('notes.scratchpad')}
            </span>
          </div>
          <SavedBadge visible={scratchSaved} label={t('notes.saved')} />
        </div>
        <textarea
          value={scratchpad}
          onChange={(e) => { setScratchpad(e.target.value); flashScratch(); }}
          placeholder={t('notes.scratchpadPlaceholder')}
          rows={5}
          style={textareaStyle}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--clay)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
        />
      </section>

      {/* 任务笔记 */}
      <section className="flex flex-col" style={{ gap: '8px' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: '6px', marginLeft: '-15px' }}>
            <Link2 size={14} style={{ color: selectedTodo ? 'var(--clay)' : 'var(--color-text-tertiary)' }} />
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}>
              {t('notes.todoNote')}
            </span>
          </div>
          <SavedBadge visible={noteSaved} label={t('notes.saved')} />
        </div>

        <TodoCombobox
          todos={activeTodos}
          linkedTodo={selectedTodo}
          disabled={false}
          placeholder={activeTodos.length === 0 ? t('notes.noTodos') : t('notes.selectTodo')}
          searchPlaceholder={t('pomodoro.searchTodo')}
          emptyText={t('pomodoro.noMatch')}
          noneText={t('pomodoro.unlink')}
          onSelect={(id) => setSelectedTodoId(id)}
        />

        {selectedTodo ? (
          <textarea
            key={selectedTodo.id}
            value={todoNotes[selectedTodo.id] ?? ''}
            onChange={(e) => { setTodoNote(selectedTodo.id, e.target.value); flashNote(); }}
            placeholder={t('notes.todoNotePlaceholder', { title: selectedTodo.title })}
            rows={6}
            style={textareaStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--clay)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
          />
        ) : (
          <div
            className="flex items-center justify-center"
            style={{
              padding: '22px 0',
              borderRadius: '8px',
              border: '0.5px dashed var(--color-border)',
              fontSize: '13px',
              color: 'var(--color-text-tertiary)',
            }}
          >
            {t('notes.selectHint')}
          </div>
        )}
      </section>
    </div>
  );
}

function SavedBadge({ visible, label }: { visible: boolean; label: string }) {
  return (
    <span
      className="flex items-center"
      style={{
        gap: '3px', fontSize: '11px', color: 'var(--olive)',
        opacity: visible ? 1 : 0,
        transition: 'opacity var(--motion-exit)',
      }}
    >
      <Check size={9} />
      {label}
    </span>
  );
}
