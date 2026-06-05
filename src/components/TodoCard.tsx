import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTodoStore, type Todo } from '../store/todoStore';
import { formatDeadline, isUrgent, isOverdue } from '../lib/utils';
import { motion } from 'framer-motion';
import { X, Edit2 } from 'lucide-react';

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
      className="rounded-lg px-4 py-3 flex items-center gap-3 transition-all cursor-pointer"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '0.5px solid var(--color-border)',
        boxShadow: 'var(--color-card-shadow)',
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
        marginBottom: 6,
        // Ancestor to the todo card
        borderLeft: hasAlert ? '3px solid var(--clay)' : undefined,
      }}
    >
      {/* Checkbox — uses Clay orange when completed */}
      <button
        onClick={() => toggleComplete(todo.id)}
        className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0"
        style={{
          borderColor: todo.completed ? 'var(--clay)' : 'var(--color-border)',
          backgroundColor: todo.completed ? 'var(--clay)' : 'transparent',
        }}
      >
        {todo.completed && (
          <span className="text-[10px] font-bold" style={{ color: 'var(--ivory-light)' }}>
            ✓
          </span>
        )}
      </button>

      {/* Title */}
      <span
        className="text-sm flex-1 transition-all select-none"
        style={{
          color: todo.completed ? 'var(--color-text-done)' : 'var(--color-text-primary)',
          textDecoration: todo.completed ? 'line-through' : 'none',
        }}
      >
        {todo.title}
      </span>

      {/* Deadline Badge — Clay for urgent */}
      {todo.deadline && (
        <span
          className="text-xs px-2 py-0.5 rounded font-medium"
          style={{
            color: hasAlert ? 'var(--clay)' : 'var(--color-text-tertiary)',
            backgroundColor: hasAlert ? 'var(--clay-light)' : 'var(--color-bg-tertiary)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em',
          }}
        >
          {overdue
            ? t('app.overdue')
            : formatDeadline(todo.deadline, 'zh' as const)}
        </span>
      )}

      {/* Hover Actions — Clay hover on delete */}
      {isHovered && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => deleteTodo(todo.id)}
            className="w-5 h-5 rounded flex items-center justify-center transition-all"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--clay)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)';
            }}
          >
            <X size={12} />
          </button>
        </div>
      )}
    </motion.div>
  );
}