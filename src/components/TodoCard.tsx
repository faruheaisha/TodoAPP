import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTodoStore, type Todo } from '../store/todoStore';
import { formatDeadline, isUrgent, isOverdue } from '../lib/utils';
import { motion } from 'framer-motion';
import { X, Edit2, Calendar } from 'lucide-react';

interface TodoCardProps {
  todo: Todo;
}

export function TodoCard({ todo }: TodoCardProps) {
  const { t } = useTranslation();
  const { language } = useTodoStore();
  const { toggleComplete, deleteTodo } = useTodoStore();
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const urgent = isUrgent(todo);
  const overdue = isOverdue(todo);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="rounded-xl border px-4 py-3 flex items-center gap-3 transition-all cursor-pointer"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg-secondary)',
        boxShadow: isHovered ? 'var(--color-card-shadow-hover)' : 'var(--color-card-shadow)',
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
        borderLeft: urgent || overdue ? '3px solid var(--color-accent)' : undefined,
      }}
    >
      {/* Checkbox */}
      <button
        onClick={() => toggleComplete(todo.id)}
        className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0"
        style={{
          borderColor: todo.completed ? 'var(--color-accent)' : 'var(--color-border)',
          backgroundColor: todo.completed ? 'var(--color-accent)' : 'transparent',
        }}
      >
        {todo.completed && (
          <span className="text-[10px] font-bold" style={{ color: '#FAF9F7' }}>
            ✓
          </span>
        )}
      </button>

      {/* Title */}
      <span
        className="text-sm flex-1 transition-all"
        style={{
          color: todo.completed ? 'var(--color-text-done)' : 'var(--color-text-primary)',
          textDecoration: todo.completed ? 'line-through' : 'none',
        }}
      >
        {todo.title}
      </span>

      {/* Deadline Badge */}
      {todo.deadline && (
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{
            color: urgent || overdue ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            backgroundColor: urgent || overdue ? 'var(--color-accent-light)' : 'var(--color-bg-tertiary)',
            fontWeight: urgent || overdue ? 600 : 400,
          }}
        >
          {overdue
            ? t('app.overdue')
            : urgent
            ? t('app.dueSoon')
            : formatDeadline(todo.deadline, 'zh' as const)}
        </span>
      )}

      {/* Hover Actions */}
      {isHovered && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="w-5 h-5 rounded flex items-center justify-center transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <Edit2 size={12} />
          </button>
          <button
            onClick={() => deleteTodo(todo.id)}
            className="w-5 h-5 rounded flex items-center justify-center transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <X size={12} />
          </button>
        </div>
      )}
    </motion.div>
  );
}
