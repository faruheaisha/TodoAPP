/**
 * TodoCard — 单条 Todo 卡片
 * v4: 标签系统 (#46) + 重复 badge (#45) + 子任务 (#44)
 */
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTodoStore, type Todo } from '../store/todoStore';
import { useSettingsStore } from '../store/settingsStore';
import { useSubtaskStore } from '../store/subtaskStore';
import { useRecurrenceStore, RECURRENCE_OPTIONS } from '../store/recurrenceStore';
import { useTagStore, TAG_PALETTE, type Tag } from '../store/tagStore';
import { TagChip } from './TagChip';
import { formatDeadline, isUrgent, isOverdue } from '../lib/utils';
import { PRIORITY_META, priorityColor } from '../lib/priority';
import { useIsTouch } from '../lib/responsive';
import { useAIStore } from '../store/aiStore';
import { BreakdownPopover } from './BreakdownPopover';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronRight, Plus, Repeat, Flag, Sparkles } from 'lucide-react';

interface TodoCardProps {
  todo: Todo;
}

export function TodoCard({ todo }: TodoCardProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const { toggleComplete, deleteTodo, setPriority } = useTodoStore();
  const { addSubtask, toggleSubtask, deleteSubtask, getSubtasks } = useSubtaskStore();
  const recurrenceRule = useRecurrenceStore((s) => s.rules[todo.id] ?? null);
  const { tags, todoTags, addTag, addTagToTodo, removeTagFromTodo, getTodoTags } = useTagStore();
  const todoTagList: Tag[] = getTodoTags(todo.id);

  const isTouch = useIsTouch();
  // manual 拖拽模式下关闭 framer 的 layout/位移动画，避免与 dnd-kit transform 互搏
  const sortMode = useSettingsStore((s) => s.sortMode);
  const isManual = sortMode === 'manual';
  const [isHovered, setIsHovered] = useState(false);
  // 触屏无 hover 概念：操作区常驻显示，保证删除/标签/子任务可达
  const showActions = isHovered || isTouch;
  const [flash, setFlash] = useState(false);
  const [subtasksOpen, setSubtasksOpen] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const aiEnabled = useAIStore((s) => s.aiEnabled);
  const [newTagName, setNewTagName] = useState('');
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
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setShowTagPicker(false); setShowPriorityPicker(false); setShowBreakdown(false); }}
    >
      {/* 主行 */}
      <motion.div
        layout={!isManual}
        initial={isManual ? false : { opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={isManual ? undefined : { opacity: 0, x: 12 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className={`todo-row flex items-center ${flash ? 'todo-flash' : ''}`}
        style={{
          minHeight: 'var(--todo-row-h)',
          padding: '7px var(--pad-x)',
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

        {/* 子任务折叠按钮 */}
        {hasSubtasks && (
          <button
            onClick={() => setSubtasksOpen((v) => !v)}
            className="flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer"
            style={{ width: '14px', height: '14px', background: 'none', border: 'none', color: 'var(--color-text-tertiary)', padding: 0 }}
          >
            {subtasksOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        )}

        {/* 优先级旗标 — 仅 priority>0 且未完成时常驻显示 */}
        {todo.priority > 0 && !todo.completed && (
          <Flag
            size={11}
            strokeWidth={2}
            style={{ flexShrink: 0, color: priorityColor(todo.priority), fill: priorityColor(todo.priority) }}
          />
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

        {/* 标签 chips */}
        {todoTagList.map(tag => (
          <TagChip key={tag.id} tag={tag} size="xs" />
        ))}

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
            className="flex-shrink-0 inline-flex items-center"
            title={RECURRENCE_OPTIONS.find(o => o.type === recurrenceRule.type)?.[lang === 'zh' ? 'labelZh' : 'labelEn']}
            style={{
              fontSize: '9px', padding: '1px 6px', borderRadius: '10px', gap: '3px',
              backgroundColor: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            <Repeat size={8} strokeWidth={2} />
            {RECURRENCE_OPTIONS.find(o => o.type === recurrenceRule.type)?.[lang === 'zh' ? 'labelZh' : 'labelEn']}
          </span>
        )}

        {/* 操作区 — 桌面 hover 显现，触屏常驻 */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="flex items-center flex-shrink-0"
              style={{ gap: '2px' }}
            >
              {/* AI 拆解（aiEnabled 才显示，且仅未完成任务） */}
              {aiEnabled && !todo.completed && (
                <button
                  onClick={() => { setShowBreakdown(v => !v); setShowTagPicker(false); setShowPriorityPicker(false); }}
                  className="flex items-center justify-center transition-colors cursor-pointer"
                  style={{
                    width: isTouch ? '34px' : '18px', height: isTouch ? '34px' : '18px', borderRadius: '6px',
                    color: showBreakdown ? 'var(--clay)' : 'var(--color-text-tertiary)',
                    border: 'none', backgroundColor: 'transparent',
                  }}
                  title={t('breakdown.title')}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--clay)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = showBreakdown ? 'var(--clay)' : 'var(--color-text-tertiary)'; }}
                >
                  <Sparkles size={11} />
                </button>
              )}
              {/* 优先级 */}
              <button
                onClick={() => { setShowPriorityPicker(v => !v); setShowTagPicker(false); setShowBreakdown(false); }}
                className="flex items-center justify-center transition-colors cursor-pointer"
                style={{
                  width: isTouch ? '34px' : '18px', height: isTouch ? '34px' : '18px', borderRadius: '6px',
                  color: todo.priority > 0 ? priorityColor(todo.priority) : (showPriorityPicker ? 'var(--clay)' : 'var(--color-text-tertiary)'),
                  border: 'none', backgroundColor: 'transparent',
                }}
                title={lang === 'zh' ? '设置优先级' : 'Set priority'}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--clay)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = todo.priority > 0 ? priorityColor(todo.priority) : (showPriorityPicker ? 'var(--clay)' : 'var(--color-text-tertiary)'); }}
              >
                <Flag size={11} strokeWidth={2} style={todo.priority > 0 ? { fill: 'currentColor' } : undefined} />
              </button>
              {/* 标签 */}
              <button
                onClick={() => { setShowTagPicker(v => !v); setShowPriorityPicker(false); }}
                className="flex items-center justify-center transition-colors cursor-pointer"
                style={{
                  width: isTouch ? '34px' : '18px', height: isTouch ? '34px' : '18px', borderRadius: '6px',
                  color: showTagPicker ? 'var(--clay)' : 'var(--color-text-tertiary)',
                  border: 'none', backgroundColor: 'transparent',
                }}
                title={lang === 'zh' ? '添加标签' : 'Add tag'}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--clay)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = showTagPicker ? 'var(--clay)' : 'var(--color-text-tertiary)'; }}
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                  <rect x="8" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                  <rect x="1" y="8" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                  <rect x="8" y="8" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                </svg>
              </button>
              {/* 添加子任务 */}
              <button
                onClick={() => {
                  setAddingSubtask(true);
                  setSubtasksOpen(true);
                  setTimeout(() => subtaskInputRef.current?.focus(), 60);
                }}
                className="flex items-center justify-center transition-colors cursor-pointer"
                style={{
                  width: isTouch ? '34px' : '18px', height: isTouch ? '34px' : '18px', borderRadius: '6px',
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
                  width: isTouch ? '34px' : '18px', height: isTouch ? '34px' : '18px', borderRadius: '6px',
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

      {/* AI 拆解弹出层 */}
      {showBreakdown && (
        <div>
          <BreakdownPopover
            todoId={todo.id}
            title={todo.title}
            onClose={() => setShowBreakdown(false)}
          />
        </div>
      )}

      {/* 优先级选择弹出层 */}
      {showPriorityPicker && (
        <div
          style={{
            position: 'absolute', top: '100%', right: 'var(--pad-x)', zIndex: 200,
            borderRadius: '8px', border: '0.5px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-primary)',
            boxShadow: 'var(--shadow-md)',
            minWidth: '130px', padding: '4px',
            display: 'flex', flexDirection: 'column', gap: '1px',
          }}
          onClick={e => e.stopPropagation()}
        >
          {PRIORITY_META.map(meta => {
            const active = todo.priority === meta.value;
            return (
              <button
                key={meta.value}
                onClick={() => { setPriority(todo.id, meta.value); setShowPriorityPicker(false); }}
                className="w-full flex items-center cursor-pointer transition-colors"
                style={{
                  gap: '8px', padding: '5px 8px', borderRadius: '5px', border: 'none',
                  backgroundColor: active ? 'var(--color-bg-tertiary)' : 'transparent',
                  color: 'var(--color-text-secondary)', fontSize: '11px',
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                <Flag size={11} strokeWidth={2} style={{ color: meta.color, fill: meta.value > 0 ? meta.color : 'none', flexShrink: 0 }} />
                <span className="flex-1 text-left">{lang === 'zh' ? meta.labelZh : meta.labelEn}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 标签选择器弹出层（在主行外，避免影响布局）*/}
      {showTagPicker && (
        <div
          style={{
            position: 'absolute', top: '100%', right: 'var(--pad-x)', zIndex: 200,
            borderRadius: '8px', border: '0.5px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-primary)',
            boxShadow: 'var(--shadow-md)',
            minWidth: '170px', padding: '8px',
            display: 'flex', flexDirection: 'column', gap: '6px',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* 已有标签 — 点击切换 */}
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {tags.map(tag => {
                const assigned = (todoTags[todo.id] ?? []).includes(tag.id);
                return (
                  <TagChip
                    key={tag.id}
                    tag={tag}
                    size="sm"
                    active={assigned}
                    onClick={() => assigned ? removeTagFromTodo(todo.id, tag.id) : addTagToTodo(todo.id, tag.id)}
                  />
                );
              })}
            </div>
          )}
          {/* 新建标签输入 */}
          <input
            autoFocus={tags.length === 0}
            type="text"
            value={newTagName}
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
              fontSize: '10px', padding: '4px 8px',
              background: 'var(--color-bg-tertiary)',
              border: '0.5px solid var(--color-border)', borderRadius: '5px',
              color: 'var(--color-text-primary)', outline: 'none', width: '100%',
            }}
          />
        </div>
      )}

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
            <div style={{ padding: '2px var(--pad-x) 6px 38px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {subtasks.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center group"
                  style={{ gap: '7px', minHeight: '24px', padding: '2px 0' }}
                >
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
                  <span
                    className="text-xs flex-1"
                    style={{
                      color: sub.completed ? 'var(--color-text-done)' : 'var(--color-text-secondary)',
                      textDecoration: sub.completed ? 'line-through' : 'none',
                    }}
                  >
                    {sub.title}
                  </span>
                  <button
                    onClick={() => deleteSubtask(todo.id, sub.id)}
                    className={`flex items-center justify-center transition-opacity cursor-pointer ${isTouch ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    style={{
                      width: isTouch ? '28px' : '14px', height: isTouch ? '28px' : '14px', borderRadius: '4px',
                      color: 'var(--color-text-tertiary)', border: 'none', backgroundColor: 'transparent',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--clay)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)'; }}
                  >
                    <X size={9} />
                  </button>
                </div>
              ))}
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
