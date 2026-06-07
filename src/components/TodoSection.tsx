import { useTranslation } from 'react-i18next';
import { useTodoStore } from '../store/todoStore';
import { sortTodos } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { TodoCard } from './TodoCard';

interface TodoSectionProps {
  filter?: 'all' | 'active' | 'completed';
}

export default function TodoSection({ filter = 'all' }: TodoSectionProps) {
  const { t } = useTranslation();
  const { todos } = useTodoStore();

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
      <AnimatePresence>
        {showQuick && (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <SectionHeader
              color="var(--color-text-tertiary)"
              label={t('app.quick')}
              count={quickTodos.length}
              suffix={t('app.items')}
            />
            {quickTodos.length > 0 ? (
              quickTodos.map((todo) => <TodoCard key={todo.id} todo={todo} />)
            ) : (
              <EmptyText />
            )}
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLongterm && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ marginTop: showQuick ? '6px' : 0 }}
          >
            <SectionHeader
              color="var(--color-accent)"
              label={t('app.longterm')}
              count={longtermTodos.length}
              suffix={`${t('app.items')} . ${t('app.sortedBy')}`}
            />
            {longtermTodos.length > 0 ? (
              longtermTodos.map((todo) => <TodoCard key={todo.id} todo={todo} />)
            ) : (
              <EmptyText />
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionHeader({ color, label, count, suffix }: { color: string; label: string; count: number; suffix: string }) {
  return (
    <div
      className="flex items-center flex-shrink-0"
      style={{
        height: 'var(--section-header-h)',
        padding: '5px 14px 3px',
        gap: '5px',
      }}
    >
      <div
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      <h2
        className="text-[10px] font-medium uppercase tracking-wider select-none"
        style={{
          color: 'var(--color-text-secondary)',
          letterSpacing: '.03em',
        }}
      >
        {label}
      </h2>
      <span className="text-[10px] ml-auto select-none" style={{ color: 'var(--color-text-tertiary)' }}>
        {count} {suffix}
      </span>
    </div>
  );
}

function EmptyText() {
  return (
    <p
      className="text-center select-none"
      style={{
        padding: '12px 14px',
        fontSize: '12px',
        color: 'var(--color-text-tertiary)',
      }}
    >
      {'无进行中'}
    </p>
  );
}
