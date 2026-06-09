import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTodoStore, type Todo } from '../store/todoStore';
import { formatDeadline, isUrgent, isOverdue } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface TodoCardProps {
  todo: Todo;
}

export function TodoCard({ todo }: TodoCardProps) {
  const { t } = useTranslation();
  const { toggleComplete, deleteTodo } = useTodoStore();
  const [isHovered, setIsHovered] = useState(false);
  const [flash, setFlash] = useState(false);

  // 完成时触发行高亮闪烁（参考 craftzdog/react-native-animated-todo 的完成反馈模式）
  const handleToggle = async () => {
    if (!todo.completed) {
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
    }
    await toggleComplete(todo.id).catch(console.error);
  };

  const urgent = isUrgent(todo);
  const overdue = isOverdue(todo);
  const hasAlert = urgent || overdue;

  return (
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
      className="flex items-center cursor-pointer"
      style={{
        height: 'var(--todo-row-h)',
        padding: '7px 14px',
        gap: '8px',
        borderTop: '0.5px solid var(--color-separator)',
      }}
    >
      {/* Checkbox — pathLength 动效（参考 Framer Motion 官方 Line Drawing 示例）*/}
      <motion.button
        onClick={handleToggle}
        whileTap={{ scale: 0.82 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: '1.5px solid',
          borderColor: todo.completed ? 'var(--clay)' : 'var(--color-checkbox-border)',
          backgroundColor: todo.completed ? 'var(--clay)' : 'transparent',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background-color 0.18s, border-color 0.18s',
        }}
      >
        <AnimatePresence>
          {todo.completed && (
            <motion.svg
              key="checkmark"
              width="9" height="7" viewBox="0 0 9 7" fill="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* pathLength 0→1 描画动效，来自 motiondivision/motion ⭐24k 官方示例 */}
              <motion.path
                d="M1 3.5L3.2 5.8L8 1"
                stroke="white"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Title — 划线动效（参考 craftzdog/react-native-animated-todo 的 strikethrough 模式）*/}
      <span
        className="text-sm select-none"
        style={{
          position: 'relative',
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: todo.completed ? 'var(--color-text-done)' : 'var(--color-text-primary)',
          transition: 'color 0.2s',
        }}
      >
        {todo.title}
        {/* 从左到右扫过的划线，替代静态 text-decoration */}
        <AnimatePresence>
          {todo.completed && (
            <motion.span
              key="strikethrough"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              exit={{ scaleX: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: '1px',
                background: 'var(--color-text-done)',
                transformOrigin: 'left center',
                pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>
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
