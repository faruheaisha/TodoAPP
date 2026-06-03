import { useTranslation } from 'react-i18next';
import { useTodoStore } from '../store/todoStore';
import { sortTodos, formatDeadline, isUrgent, isOverdue } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { TodoCard } from './TodoCard';

export default function TodoSection() {
  const { t } = useTranslation();
  const { todos } = useTodoStore();

  const sorted = sortTodos(todos);
  const quickTodos = sorted.filter((t) => t.todoType === 'quick');
  const longtermTodos = sorted.filter((t) => t.todoType === 'longterm');

  return (
    <div>
      {/* Quick Section */}
      <AnimatePresence>
        {quickTodos.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: 'var(--color-text-tertiary)' }}
              />
              <h2
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {t('app.quick')}
              </h2>
              <span
                className="text-xs"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {quickTodos.length} {t('app.items')}
              </span>
            </div>
            {quickTodos.map((todo) => (
              <TodoCard key={todo.id} todo={todo} />
            ))}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Long-term Section */}
      <AnimatePresence>
        {longtermTodos.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: 'var(--color-accent)' }}
              />
              <h2
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {t('app.longterm')}
              </h2>
              <span
                className="text-xs"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {longtermTodos.length} {t('app.items')} · {t('app.sortedBy')}
              </span>
            </div>
            {longtermTodos.map((todo) => (
              <TodoCard key={todo.id} todo={todo} />
            ))}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
