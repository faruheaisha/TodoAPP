/**
 * TodoCard — 单条 Todo 卡片
 *
 * v2 新增：子任务 Checklist（Things 3 风格内联展开）
 *  - 参考 Todoist 的子任务进度圆形 badge + 展开列表
 *  - 参考 Things 3 的 Checklist：轻量、行内、无层级
 *
 * v3 新增：重复规则 badge（#45 Recurrence）
 */
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTodoStore, type Todo } from '../store/todoStore';
import { useSubtaskStore } from '../store/subtaskStore';
import { useRecurrenceStore, RECURRENCE_OPTIONS } from '../store/recurrenceStore';
import { formatDeadline, isUrgent, isOverdue } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronRight, Plus } from 'lucide-react';

interface TodoCardProps {
  todo: Todo;
}

export function TodoCard({ todo }: TodoCardProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const { toggleComplete, deleteTodo } = useTodoStore();
  const { addSubtask, toggleSubtask, deleteSubtask, getSubtasks } = useSubtaskStore();
  const recurrenceRule = useRecurrenceStore((s) => s.rules[todo.id] ?? null);

  const [isHovered, setIsHovered] = useState(false);
  const [flash, setFlash] = useState(false);
  const [subtasksOpen, setSubtasksOpen] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  const subtasks = getSubtasks(todo.id);
  const subtaskCount = subtasks.length;
  const doneCount = subtasks.filter((s) => s.completed).length;
  const hasSubtasks = subtaskCount > 0;

  const handleToggle = async () => {
    if (!todo.completed) {
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
    }
    await toggleComplete(todo.id).catch(console.error);
  };

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

  return (
    <div>
      {/* 主行 */}
      <motion.div
        layout
        initial={{ opacity: 0, x: -12 }}
        animate={flash
          ? { opacity: 1, x: 0, backgroundColor: ['transparent', 'rgba(217,119,87,0.10)', 'transparent'] }
          : { opacity: 1, x: 0, backgroundColor: 'transparent' }
        }
        exit={{ opacity: 0, x: 12 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex items-center"
        style={{
          minHeight: 'var(--todo-row-h)',
          padding: '7px 14px',
          gap: '8px',
          borderTop: '0.5px solid var(--color-separator)',
          cursor: 'default',
        }}
      >
        {/* Checkbox */}
        <motion.button
          onClick={handleToggle}
          whileTap={{ scale: 0.82 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: '16px', height: '16px', borderRadius: '50%',
            border: '1.5px solid',
            borderColor: todo.completed ? 'var(--clay)' : 'var(--color-checkbox-border)',
            backgroundColor: todo.completed ? 'var(--clay)' : 'transparent',
            cursor: 'pointer', flexShrink: 0,
            transition: 'background-color 0.18s, border-color 0.18s',
          }}
        >
          <AnimatePresence>
            {todo.completed && (
              <motion.svg key="checkmark" width="9" height="7" viewBox="0 0 9 7" fill="none"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              >
                <motion.path d="M1 3.5L3.2 5.8L8 1" stroke="white" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                />
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.button>

        {/* 子任务折叠按钮（仅有子任务时显示） */}
        {hasSubtasks && (
          <button
            onClick={() => setSubtasksOpen((v) => !v)}
            className="flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer"
            style={{ width: '14px', height: '14px', background: 'none', border: 'none', color: 'var(--color-text-tertiary)', padding: 0 }}
          >
            {subtasksOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        )}

        {/* Title */}
        <span
          className="text-sm select-none"
          style={{
            position: 'relative', flex: 1, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: todo.completed ? 'var(--color-text-done)' : 'var(--color-text-primary)',
            transition: 'color 0.2s',
          }}
        >
          {todo.title}
          <AnimatePresence>
            {todo.completed && (
              <motion.span key="strikethrough"
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                style={{
                  position: 'absolute', top: '50%', left: 0, right: 0,
                  height: '1px', background: 'var(--color-text-done)',
                  transformOrigin: 'left center', pointerEvents: 'none',
                }}
              />
            )}
          </AnimatePresence>
        </span>

        {/* 子任务进度 badge */}
        {hasSubtasks && (
          <button
            onClick={() => setSubtasksOpen((v) => !v)}
            className="flex-shrink-0 transition-colors cursor-pointer"
            style={{
              fontSize: '9px', fontWeight: 600,
              padding: '1px 6px', borderRadius: '10px',
              background: doneCount === subtaskCount ? 'var(--clay-light)' : 'var(--color-bg-tertiary)',
              color: doneCount === subtaskCount ? 'var(--clay)' : 'var(--color-text-tertiary)',
              border: 'none', fontVariantNumeric: 'tabular-nums',
            }}
          >
            {doneCount}/{subtaskCount}
          </button>
        )}

        {/* Deadline badge */}
        {todo.deadline && (
          <span
            className="deadline-label text-xs px-2 py-0.5 rounded font-medium flex-shrink-0"
            style={{
              color: hasAlert ? 'var(--clay)' : 'var(--color-text-tertiary)',
              backgroundColor: hasAlert ? 'var(--clay-light)' : 'var(--color-bg-tertiary)',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
            }}
          >
            {overdue ? t('app.overdue') : formatDeadline(todo.deadline, 'zh' as const)}
          </span>
        )}

        {/* 重复规则 badge */}
        {recurrenceRule && (
          <span
            className="flex-shrink-0"
            title={RECURRENCE_OPTIONS.find(o => o.type === recurrenceRule.type)?.[lang === 'zh' ? 'labelZh' : 'labelEn']}
            style={{
              fontSize: '9px', padding: '1px 5px', borderRadius: '10px',
              backgroundColor: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            🔁 {RECURRENCE_OPTIONS.find(o => o.type === recurrenceRule.type)?.[lang === 'zh' ? 'labelZh' : 'labelEn']}
          </span>
        )}

        {/* Hover 操作区：添加子任务 + 删除 */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="flex items-center flex-shrink-0"
              style={{ gap: '2px' }}
            >
              {/* 添加子任务 */}
              <button
                onClick={() => {
                  setAddingSubtask(true);
                  setSubtasksOpen(true);
                  setTimeout(() => subtaskInputRef.current?.focus(), 60);
                }}
                className="flex items-center justify-center transition-colors cursor-pointer"
                style={{
                  width: '18px', height: '18px', borderRadius: '4px',
                  color: 'var(--color-text-tertiary)', border: 'none', backgroundColor: 'transparent',
                }}
                title={t('app.addSubtask')}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--clay)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)'; }}
              >
                <Plus size={11} />
              </button>
              {/* 删除 */}
              <button
                onClick={() => deleteTodo(todo.id).catch(console.error)}
                className="flex items-center justify-center transition-colors cursor-pointer"
                style={{
                  width: '18px', height: '18px', borderRadius: '4px',
                  color: 'var(--color-text-tertiary)', border: 'none', backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--clay)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)'; }}
              >
                <X size={11} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 子任务面板 */}
      <AnimatePresence>
        {subtasksOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '2px 14px 6px 38px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {subtasks.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center group"
                  style={{ gap: '7px', minHeight: '24px', padding: '2px 0' }}
                >
                  {/* 方形 checkbox */}
                  <button
                    onClick={() => toggleSubtask(todo.id, sub.id)}
                    className="flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer"
                    style={{
                      width: '13px', height: '13px', borderRadius: '3px',
                      border: '1.5px solid',
                      borderColor: sub.completed ? 'var(--clay)' : 'var(--color-checkbox-border)',
                      backgroundColor: sub.completed ? 'var(--clay)' : 'transparent',
                    }}
                  >
                    {sub.completed && (
                      <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
                        <path d="M1 2.5L2.8 4.2L6 1" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  {/* 子任务标题 */}
                  <span
                    className="text-xs flex-1"
                    style={{
                      color: sub.completed ? 'var(--color-text-done)' : 'var(--color-text-secondary)',
                      textDecoration: sub.completed ? 'line-through' : 'none',
                    }}
                  >
                    {sub.title}
                  </span>
                  {/* hover 删除 */}
                  <button
                    onClick={() => deleteSubtask(todo.id, sub.id)}
                    className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    style={{
                      width: '14px', height: '14px', borderRadius: '3px',
                      color: 'var(--color-text-tertiary)', border: 'none', backgroundColor: 'transparent',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--clay)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)'; }}
                  >
                    <X size={9} />
                  </button>
                </div>
              ))}

              {/* 新增子任务输入框 */}
              {addingSubtask && (
                <div className="flex items-center" style={{ gap: '7px', minHeight: '24px', padding: '2px 0' }}>
                  <div style={{ width: '13px', height: '13px', borderRadius: '3px', border: '1.5px dashed var(--color-border)', flexShrink: 0 }} />
                  <input
                    ref={subtaskInputRef}
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={handleSubtaskKeyDown}
                    onBlur={handleAddSubtask}
                    placeholder={t('app.subtaskPlaceholder')}
                    className="flex-1 text-xs outline-none bg-transparent"
                    style={{ color: 'var(--color-text-secondary)', border: 'none' }}
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
