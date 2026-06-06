import { useTranslation } from 'react-i18next';
import { useTodoStore } from '../store/todoStore';
import { sortTodos, formatDeadline, isUrgent, isOverdue } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { TodoCard } from './TodoCard';

interface TodoSectionProps {
  filter?: 'all' | 'active' | 'completed';
}

export default function TodoSection({ filter = 'all' }: TodoSectionProps) {
  const { t } = useTranslation();
  const { todos } = useTodoStore();

  // Apply filter
  let filtered = todos;
  if (filter === 'active') filtered = todos.filter(t => !t.completed);
  if (filter === 'completed') filtered = todos.filter(t => t.completed);

  const sorted = sortTodos(filtered);
  const quickTodos = sorted.filter((t) => t.todoType === 'quick');
  const longtermTodos = sorted.filter((t) => t.todoType === 'longterm');

  const showQuick = filter !== 'completed' || quickTodos.length > 0;
  const showLongterm = filter !== 'completed' || longtermTodos.length > 0;

  return (
    <div>
      {/* Quick Section */}
      <AnimatePresence>
        {showQuick && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4"
          >
            {/* Section header — with light grey background */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-md mb-2"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                minHeight: '28px',
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: 'var(--color-text-tertiary)' }}
              />
              <h2
                className="text-[10px] font-medium uppercase tracking-wider select-none"
                style={{
                  color: 'var(--color-text-secondary)',
                  letterSpacing: '.04em',
                }}
              >
                {t('app.quick')}
              </h2>
              <span
                className="text-[10px] ml-auto select-none"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {quickTodos.length} {t('app.items')}
              </span>
            </div>
            {quickTodos.length > 0 ? (
              quickTodos.map((todo) => (
                <TodoCard key={todo.id} todo={todo} />
              ))
            ) : (
              <p
                className="text-center py-2 text-[11px] select-none"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                无进行中
              </p>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Long-term Section */}
      <AnimatePresence>
        {showLongterm && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-md mb-2"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                minHeight: '28px',
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: 'var(--color-accent)' }}
              />
              <h2
                className="text-[10px] font-medium uppercase tracking-wider select-none"
                style={{
                  color: 'var(--color-text-secondary)',
                  letterSpacing: '.04em',
                }}
              >
                {t('app.longterm')}
              </h2>
              <span
                className="text-[10px] ml-auto select-none"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {longtermTodos.length} {t('app.items')} · {t('app.sortedBy')}
              </span>
            </div>
            {longtermTodos.length > 0 ? (
              longtermTodos.map((todo) => (
                <TodoCard key={todo.id} todo={todo} />
              ))
            ) : (
              <p
                className="text-center py-2 text-[11px] select-none"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                无进行中
              </p>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}