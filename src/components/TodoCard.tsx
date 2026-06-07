import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTodoStore, type Todo } from '../store/todoStore';
import { formatDeadline, isUrgent, isOverdue } from '../lib/utils';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface TodoCardProps {
  todo: Todo;
}

export function TodoCard({ todo }: TodoCardProps) {
  const { t } = useTranslation();
  const { toggleComplete, deleteTodo } = useTodoStore();
  const [isHovered, setIsHovered] = useState(false);

  const urgent = isUrgent(todo);
  const overdue = isOverdue(todo);
  const hasAlert = urgent || overdue;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex items-center cursor-pointer"
      style={{
        height: 'var(--todo-row-h)',
        padding: '7px 14px',
        gap: '8px',
        borderTop: '0.5px solid var(--color-separator)',
      }}
    >
      {/* Checkbox — 16x16px */}
      <button
        onClick={() => toggleComplete(todo.id).catch(console.error)}
        className="flex items-center justify-center flex-shrink-0 transition-colors"
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: '1.5px solid',
          borderColor: todo.completed ? 'var(--clay)' : 'var(--color-checkbox-border)',
          backgroundColor: todo.completed ? 'var(--clay)' : 'transparent',
          cursor: 'pointer',
        }}
      >
        {todo.completed && (
          <span className="text-[8px] font-bold" style={{ color: 'var(--ivory-light)' }}>
            {'✓'}
          </span>
        )}
      </button>

      {/* Title */}
      <span
        className="text-sm select-none"
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: todo.completed ? 'var(--color-text-done)' : 'var(--color-text-primary)',
          textDecoration: todo.completed ? 'line-through' : 'none',
        }}
      >
        {todo.title}
      </span>

      {/* Deadline badge */}
      {todo.deadline && (
        <span
          className="deadline-label text-xs px-2 py-0.5 rounded font-medium flex-shrink-0"
          style={{
            color: hasAlert ? 'var(--clay)' : 'var(--color-text-tertiary)',
            backgroundColor: hasAlert ? 'var(--clay-light)' : 'var(--color-bg-tertiary)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em',
            marginLeft: 'auto',
          }}
        >
          {overdue ? t('app.overdue') : formatDeadline(todo.deadline, 'zh' as const)}
        </span>
      )}

      {/* Delete button on hover */}
      {isHovered && (
        <button
          onClick={() => deleteTodo(todo.id).catch(console.error)}
          className="flex items-center justify-center flex-shrink-0 transition-colors"
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '4px',
            color: 'var(--color-text-tertiary)',
            cursor: 'pointer',
            border: 'none',
            backgroundColor: 'transparent',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--clay)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)';
          }}
        >
          <X size={12} />
        </button>
      )}
    </motion.div>
  );
}
