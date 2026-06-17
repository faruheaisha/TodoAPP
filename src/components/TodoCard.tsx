/**
 * TodoCard — Linear 风格单条 Todo 行
 * Preserves all existing features: subtasks, tags, priorities, recurrence, AI breakdown, dnd-kit
 */
import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTodoStore, type Todo } from '../store/todoStore';
import { useSettingsStore } from '../store/settingsStore';
import { useSubtaskStore } from '../store/subtaskStore';
import { useRecurrenceStore, RECURRENCE_OPTIONS } from '../store/recurrenceStore';
import { useTagStore, TAG_PALETTE, type Tag } from '../store/tagStore';
import { TagChip } from './TagChip';
import { formatDeadline, isUrgent, isOverdue, classifyTodo } from '../lib/utils';
import { PRIORITY_META, priorityColor } from '../lib/priority';
import { useIsTouch } from '../lib/responsive';
import { useAIStore } from '../store/aiStore';
import DatePicker from './DatePicker';
import { BreakdownPopover } from './BreakdownPopover';
import { AnimatePresence, motion } from 'framer-motion';

interface TodoCardProps {
  todo: Todo;
}

/* ─── 内联 SVG 图标 ─── */
function CheckMarkSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4"
      strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <path d="M5 12.5l4.2 4.5L19 7" strokeDasharray="18"
        style={{ strokeDashoffset: 0, animation: 'linear-drawCheck .26s ease forwards' }} />
    </svg>
  );
}

function FlagSvg({ filled, color }: { filled?: boolean; color?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? (color || 'currentColor') : 'none'}
      stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M5 21V4" /><path d="M5 4h11l-2 3.5L16 11H5" />
    </svg>
  );
}

function ChevronRightSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function ChevronDownSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function PlusSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <path d="M12 5v14" /><path d="M5 12h14" />
    </svg>
  );
}

function XSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <path d="M18 6L6 18" /><path d="M6 6l12 12" />
    </svg>
  );
}

function SparklesSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
      <path d="M18.5 16l-.8 2.3L20 19l-2.3.8L18 22l-.8-2.3L15 19l2.3-.8z" />
    </svg>
  );
}

function RepeatSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <path d="M17 2l3 3-3 3" /><path d="M20 5H8a4 4 0 0 0-4 4" /><path d="M7 22l-3-3 3-3" /><path d="M4 19h12a4 4 0 0 0 4-4" />
    </svg>
  );
}

function TagGridSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="1" y="1" width="5" height="5" rx="1.5" /><rect x="8" y="1" width="5" height="5" rx="1.5" />
      <rect x="1" y="8" width="5" height="5" rx="1.5" /><rect x="8" y="8" width="5" height="5" rx="1.5" />
    </svg>
  );
}

function CalendarSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

/* ─── 主组件 ─── */

export function TodoCard({ todo }: TodoCardProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const { toggleComplete, deleteTodo, setPriority, updateTodo } = useTodoStore();
  const { addSubtask, toggleSubtask, deleteSubtask, getSubtasks } = useSubtaskStore();
  const recurrenceRule = useRecurrenceStore((s) => s.rules[todo.id] ?? null);
  const { tags, todoTags, addTag, addTagToTodo, removeTagFromTodo, getTodoTags } = useTagStore();
  const todoTagList: Tag[] = getTodoTags(todo.id);

  const isTouch = useIsTouch();
  const sortMode = useSettingsStore((s) => s.sortMode);
  const isManual = sortMode === 'manual';
  const [hovered, setHovered] = useState(false);
  const showActions = hovered || isTouch;
  const [flash, setFlash] = useState(false);
  const [checkPop, setCheckPop] = useState(false);
  const [subtasksOpen, setSubtasksOpen] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const aiEnabled = useAIStore((s) => s.aiEnabled);
  const [newTagName, setNewTagName] = useState('');
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  const subtasks = getSubtasks(todo.id);
  const subtaskCount = subtasks.length;
  const doneCount = subtasks.filter((s) => s.completed).length;
  const hasSubtasks = subtaskCount > 0;

  const handleToggle = useCallback(async () => {
    if (!todo.completed) {
      setFlash(true);
      setCheckPop(true);
      setTimeout(() => { setFlash(false); setCheckPop(false); }, 600);
    }
    await toggleComplete(todo.id).catch(console.error);
  }, [todo.id, todo.completed, toggleComplete]);

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) { setAddingSubtask(false); return; }
    addSubtask(todo.id, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
    setSubtasksOpen(true);
    setTimeout(() => subtaskInputRef.current?.focus(), 50);
  };

  const handleSubtaskKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddSubtask();
    if (e.key === 'Escape') { setAddingSubtask(false); setNewSubtaskTitle(''); }
  };

  const urgent = isUrgent(todo);
  const overdue = isOverdue(todo);
  const hasAlert = urgent || overdue;
  const classification = classifyTodo(todo);

  return (
    <div
      className="linear-row-enter"
      style={{ animationDelay: '0ms', position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowTagPicker(false); setShowPriorityPicker(false); setShowBreakdown(false); setShowDatePicker(false); }}
    >
      <div
        className={flash ? 'todo-flash' : ''}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '9px var(--pad-x)', borderRadius: 9,
          transition: 'background .14s ease',
          background: hovered ? 'var(--card-hover)' : 'transparent',
          cursor: 'default',
          position: 'relative',
        }}
      >
        {/* Checkbox */}
        <button
          onClick={handleToggle}
          aria-pressed={todo.completed}
          style={{
            flex: '0 0 auto', width: 18, height: 18, marginTop: 1, borderRadius: '50%',
            border: `1.6px solid ${todo.completed ? 'var(--clay)' : 'var(--ink-4)'}`,
            background: todo.completed ? 'var(--clay)' : 'transparent',
            display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0,
            transition: 'border-color .16s, background .16s',
            animation: checkPop && todo.completed ? 'linear-checkPop .28s ease' : 'none',
          }}
          onMouseEnter={(e) => { if (!todo.completed) e.currentTarget.style.borderColor = 'var(--clay)'; }}
          onMouseLeave={(e) => { if (!todo.completed) e.currentTarget.style.borderColor = 'var(--ink-4)'; }}
        >
          {todo.completed && <CheckMarkSvg />}
        </button>

        {/* Subtask expand button */}
        {hasSubtasks && (
          <button
            onClick={() => setSubtasksOpen((v) => !v)}
            style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--ink-4)', marginTop: 2 }}
          >
            {subtasksOpen ? <ChevronDownSvg /> : <ChevronRightSvg />}
          </button>
        )}

        {/* Priority flag */}
        {todo.priority > 0 && !todo.completed && (
          <FlagSvg filled color={priorityColor(todo.priority)} />
        )}

        {/* Title */}
        <span style={{
          fontSize: 14.5, lineHeight: 1.45,
          color: todo.completed ? 'var(--ink-4)' : 'var(--color-text-primary)',
          textDecoration: todo.completed ? 'line-through' : 'none',
          textDecorationColor: 'var(--ink-4)',
          transition: 'color .2s',
          flex: '1 1 auto', minWidth: 0, paddingTop: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {todo.title}
        </span>

        {/* Subtask progress badge */}
        {hasSubtasks && (
          <button
            onClick={() => setSubtasksOpen((v) => !v)}
            style={{
              flexShrink: 0, fontSize: 11.5, fontWeight: 500,
              padding: '2px 7px', borderRadius: 6, lineHeight: 1,
              background: doneCount === subtaskCount ? 'var(--clay-light)' : '#fff',
              color: doneCount === subtaskCount ? 'var(--clay)' : 'var(--ink-2)',
              border: doneCount === subtaskCount ? '0.5px solid var(--clay)' : '0.5px solid var(--color-border)',
              cursor: 'pointer', fontVariantNumeric: 'tabular-nums',
            }}
          >
            {doneCount}/{subtaskCount}
          </button>
        )}

        {/* Meta chips: only on hover, slide in from right */}
        {!todo.completed && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translateX(0)' : 'translateX(6px)',
            transition: 'opacity .18s ease, transform .18s ease',
            paddingLeft: 12,
          }}>
            {todoTagList.map(tag => (
              <span key={tag.id} style={{
                fontSize: 11.5, color: 'var(--ink-2)', background: '#fff',
                border: '0.5px solid var(--color-border)', borderRadius: 6,
                padding: '3px 8px', lineHeight: 1, whiteSpace: 'nowrap',
              }}>
                {tag.name}
              </span>
            ))}
            {/* Quick action buttons */}
            {aiEnabled && (
              <button
                onClick={() => { setShowBreakdown(v => !v); setShowTagPicker(false); setShowPriorityPicker(false); setShowDatePicker(false); }}
                className="linear-ghost-btn"
                style={{ fontSize: 11.5, padding: '2px 6px', color: showBreakdown ? 'var(--clay)' : 'var(--ink-2)' }}
                title={t('breakdown.title')}
              >
                <SparklesSvg />
              </button>
            )}
            <button
              onClick={() => { setShowPriorityPicker(v => !v); setShowTagPicker(false); setShowBreakdown(false); setShowDatePicker(false); }}
              className="linear-ghost-btn"
              style={{ fontSize: 11.5, padding: '2px 6px', color: todo.priority > 0 ? priorityColor(todo.priority) : 'var(--ink-2)' }}
              title={lang === 'zh' ? '设置优先级' : 'Set priority'}
            >
              <FlagSvg />
            </button>
            <button
              onClick={() => { setShowTagPicker(v => !v); setShowPriorityPicker(false); setShowDatePicker(false); }}
              className="linear-ghost-btn"
              style={{ fontSize: 11.5, padding: '2px 6px', color: showTagPicker ? 'var(--clay)' : 'var(--ink-2)' }}
              title={lang === 'zh' ? '添加标签' : 'Add tag'}
            >
              <TagGridSvg />
            </button>
            <button
              onClick={() => {
                setAddingSubtask(true);
                setSubtasksOpen(true);
                setTimeout(() => subtaskInputRef.current?.focus(), 60);
              }}
              className="linear-ghost-btn"
              style={{ fontSize: 11.5, padding: '2px 6px', color: 'var(--ink-2)' }}
              title={t('app.addSubtask')}
            >
              <PlusSvg />
            </button>
            {/* Deadline button (long-term only) */}
            {todo.todoType === 'longterm' && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => { setShowDatePicker(v => !v); setShowPriorityPicker(false); setShowTagPicker(false); }}
                  className="linear-ghost-btn"
                  style={{
                    fontSize: 11.5, padding: '2px 6px',
                    color: todo.deadline ? (overdue ? '#E5484D' : 'var(--clay)') : 'var(--ink-2)',
                  }}
                  title={lang === 'zh' ? '设置截止时间' : 'Set deadline'}
                >
                  <CalendarSvg />
                </button>
                {showDatePicker && (
                  <div style={{ position: 'absolute', top: '28px', right: 0, zIndex: 200 }}
                    onClick={e => e.stopPropagation()}>
                    <DatePicker
                      value={todo.deadline || ''}
                      onChange={(v) => { updateTodo(todo.id, { deadline: v || null }); setShowDatePicker(false); }}
                      onClose={() => setShowDatePicker(false)}
                      lang={lang}
                    />
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => deleteTodo(todo.id).catch(console.error)}
              className="linear-ghost-btn"
              style={{ fontSize: 11.5, padding: '2px 6px', color: 'var(--ink-2)' }}
            >
              <XSvg />
            </button>
          </div>
        )}

        {/* Recurrence badge */}
        {recurrenceRule && (
          <span style={{
            flexShrink: 0, fontSize: 11.5, fontWeight: 500,
            padding: '2px 7px', borderRadius: 6, lineHeight: 1, gap: 3,
            display: 'inline-flex', alignItems: 'center',
            background: '#fff', color: 'var(--ink-2)',
            border: '0.5px solid var(--color-border)',
          }}>
            <RepeatSvg />
            {RECURRENCE_OPTIONS.find(o => o.type === recurrenceRule.type)?.[lang === 'zh' ? 'labelZh' : 'labelEn']}
          </span>
        )}
      </div>

      {/* AI breakdown popover */}
      {showBreakdown && (
        <BreakdownPopover
          todoId={todo.id}
          title={todo.title}
          onClose={() => setShowBreakdown(false)}
        />
      )}

      {/* Priority picker */}
      {showPriorityPicker && (
        <div
          style={{
            position: 'absolute', top: '100%', right: 12, zIndex: 200,
            borderRadius: 7, border: '0.5px solid var(--color-border)',
            background: 'var(--color-bg-primary)',
            boxShadow: 'var(--shadow-md)',
            minWidth: 105, padding: 3,
            display: 'flex', flexDirection: 'column', gap: 1,
          }}
          onClick={e => e.stopPropagation()}
        >
          {PRIORITY_META.map(meta => {
            const active = todo.priority === meta.value;
            return (
              <button
                key={meta.value}
                onClick={() => { setPriority(todo.id, meta.value); setShowPriorityPicker(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '3px 7px', borderRadius: 4, border: 'none',
                  background: active ? 'var(--color-bg-tertiary)' : 'transparent',
                  color: 'var(--color-text-secondary)', fontSize: 8,
                  cursor: 'pointer', textAlign: 'left', font: 'inherit',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--color-bg-tertiary)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill={meta.value > 0 ? meta.color : 'none'}
                  stroke={meta.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ display: 'block', flexShrink: 0 }}>
                  <path d="M5 21V4" /><path d="M5 4h11l-2 3.5L16 11H5" />
                </svg>
                <span style={{ flex: 1, fontSize: 10 }}>{lang === 'zh' ? meta.labelZh : meta.labelEn}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Tag picker */}
      {showTagPicker && (
        <div
          style={{
            position: 'absolute', top: '100%', right: 12, zIndex: 200,
            borderRadius: 8, border: '0.5px solid var(--color-border)',
            background: 'var(--color-bg-primary)',
            boxShadow: 'var(--shadow-md)',
            minWidth: 170, padding: 8,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}
          onClick={e => e.stopPropagation()}
        >
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {tags.map(tag => {
                const assigned = (todoTags[todo.id] ?? []).includes(tag.id);
                return (
                  <TagChip
                    key={tag.id} tag={tag} size="sm"
                    active={assigned}
                    onClick={() => assigned ? removeTagFromTodo(todo.id, tag.id) : addTagToTodo(todo.id, tag.id)}
                  />
                );
              })}
            </div>
          )}
          <input
            autoFocus={tags.length === 0}
            type="text" value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newTagName.trim()) {
                const color = TAG_PALETTE[tags.length % TAG_PALETTE.length];
                const tag = addTag(newTagName.trim(), color);
                addTagToTodo(todo.id, tag.id);
                setNewTagName('');
              }
              if (e.key === 'Escape') setShowTagPicker(false);
            }}
            placeholder={lang === 'zh' ? '新建标签 Enter 确认…' : 'New tag, Enter to add…'}
            style={{
              fontSize: 10, padding: '4px 8px',
              background: 'var(--color-bg-tertiary)',
              border: '0.5px solid var(--color-border)', borderRadius: 5,
              color: 'var(--color-text-primary)', outline: 'none', width: '100%',
            }}
          />
        </div>
      )}

      {/* Subtask panel */}
      <AnimatePresence>
        {subtasksOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '2px var(--pad-x) 6px 42px', display: 'flex', flexDirection: 'column', gap: 1 }}>
              {subtasks.map((sub) => (
                <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 7, minHeight: 24, padding: '2px 0' }}>
                  <button
                    onClick={() => toggleSubtask(todo.id, sub.id)}
                    style={{
                      flexShrink: 0, width: 13, height: 13, borderRadius: 3,
                      border: '1.5px solid',
                      borderColor: sub.completed ? 'var(--clay)' : 'var(--ink-4)',
                      background: sub.completed ? 'var(--clay)' : 'transparent',
                      cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center',
                    }}
                  >
                    {sub.completed && (
                      <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
                        <path d="M1 2.5L2.8 4.2L6 1" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span style={{
                    fontSize: 12.5, flex: 1,
                    color: sub.completed ? 'var(--ink-4)' : 'var(--ink-2)',
                    textDecoration: sub.completed ? 'line-through' : 'none',
                  }}>
                    {sub.title}
                  </span>
                  <button
                    onClick={() => deleteSubtask(todo.id, sub.id)}
                    className="linear-ghost-btn"
                    style={{
                      fontSize: 11.5, padding: '1px 4px',
                      opacity: hovered || isTouch ? 1 : 0,
                      color: 'var(--ink-2)',
                    }}
                  >
                    <XSvg />
                  </button>
                </div>
              ))}
              {addingSubtask && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minHeight: 24, padding: '2px 0' }}>
                  <div style={{ width: 13, height: 13, borderRadius: 3, border: '1.5px dashed var(--color-border)', flexShrink: 0 }} />
                  <input
                    ref={subtaskInputRef}
                    type="text" value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={handleSubtaskKeyDown}
                    onBlur={handleAddSubtask}
                    placeholder={t('app.subtaskPlaceholder')}
                    style={{
                      flex: 1, fontSize: 12.5, border: 'none', outline: 'none',
                      background: 'transparent', color: 'var(--ink-2)', font: 'inherit',
                    }}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
