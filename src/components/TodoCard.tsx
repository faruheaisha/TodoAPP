/**
 * TodoCard — 单条 Todo 卡片
 *
 * v2 新增：子任务 Checklist（Things 3 风格内联展开）
 *  - 参考 Todoist 的子任务进度圆形 badge + 展开列表
 *  - 参考 Things 3 的 Checklist：轻量、行内、无层级
 *
 * 交互：
 *  - 点击标题右侧的「+」图标展开子任务输入
 *  - 有子任务时标题旁显示进度 badge「2/5」
 *  - 点击 badge / chevron 展开子任务列表
 */
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTodoStore, type Todo } from '../store/todoStore';
import { useSubtaskStore } from '../store/subtaskStore';
import { formatDeadline, isUrgent, isOverdue } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronRight, Plus } from 'lucide-react';

interface TodoCardProps {
  todo: Todo;
}

export function TodoCard({ todo }: TodoCardProps) {
  const { t } = useTranslation();
  const { toggleComplete, deleteTodo } = useTodoStore();
  const { addSubtask, toggleSubtask, deleteSubtask, getSubtasks } = useSubtaskStore();

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
    // 保持展开并保持输入框
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
            {subtasksOpen
              ? <ChevronDown size={11} />
              : <ChevronRight size={11} />
            }
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
                  transformOrigin: 'left center', pointer