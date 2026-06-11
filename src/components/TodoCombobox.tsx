/**
 * TodoCombobox — 可搜索的任务选择器（共享组件）
 * 用于番茄钟任务关联、笔记任务绑定等场景。
 * 触发态为紧凑按钮；展开后顶部搜索框 + 过滤列表（160px 内滚动），
 * Enter 选首项、Esc 关闭、点击外部关闭。
 */
import { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, Check } from 'lucide-react';
import type { Todo } from '../store/todoStore';

export function TodoCombobox({
  todos, linkedTodo, disabled, placeholder, searchPlaceholder, emptyText, noneText, onSelect,
}: {
  todos: Todo[];
  linkedTodo: Todo | null;
  disabled: boolean;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  noneText: string;
  onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return todos;
    return todos.filter((todo) => todo.title.toLowerCase().includes(q));
  }, [todos, query]);

  const openList = () => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const pick = (id: string | null) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      {/* 触发按钮 — 外观与原 select 一致 */}
      <button
        onClick={() => (open ? setOpen(false) : openList())}
        disabled={disabled}
        className="w-full flex items-center text-[11px] cursor-pointer"
        style={{
          background: 'var(--color-bg-tertiary)',
          border: '1px solid ' + (linkedTodo ? 'var(--clay)' : 'var(--color-border)'),
          borderRadius: '6px',
          color: linkedTodo ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
          padding: '5px 8px 5px 10px',
          opacity: disabled ? 0.6 : 1,
          gap: '6px',
          transition: 'border-color var(--transition-fast)',
        }}
      >
        <span className="flex-1 text-left" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {linkedTodo ? linkedTodo.title : placeholder}
        </span>
        <ChevronDown size={11} style={{ flexShrink: 0, color: 'var(--color-text-tertiary)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--transition-fast)' }} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* 点击外部关闭 */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -2, scale: 0.98 }}
              transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
              style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
                borderRadius: '8px',
                border: '0.5px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-primary)',
                boxShadow: 'var(--shadow-md)',
                overflow: 'hidden',
              }}
            >
              {/* 搜索框 */}
              <div className="flex items-center" style={{ gap: '6px', padding: '7px 9px', borderBottom: '0.5px solid var(--color-separator)' }}>
                <Search size={11} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setOpen(false);
                    if (e.key === 'Enter' && filtered.length > 0) pick(filtered[0].id);
                  }}
                  placeholder={searchPlaceholder}
                  className="flex-1 text-[11px] outline-none bg-transparent"
                  style={{ color: 'var(--color-text-primary)', border: 'none' }}
                />
              </div>

              {/* 列表 */}
              <div className="tools-scroll" style={{ maxHeight: '160px', overflowY: 'auto', padding: '4px' }}>
                {linkedTodo && (
                  <ComboItem onClick={() => pick(null)} muted>
                    {noneText}
                  </ComboItem>
                )}
                {filtered.length === 0 ? (
                  <div className="text-center" style={{ padding: '12px 0', fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
                    {emptyText}
                  </div>
                ) : (
                  filtered.map((todo) => (
                    <ComboItem key={todo.id} onClick={() => pick(todo.id)} selected={linkedTodo?.id === todo.id}>
                      {todo.title}
                    </ComboItem>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ComboItem({ children, onClick, selected, muted }: {
  children: React.ReactNode; onClick: () => void; selected?: boolean; muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center text-left cursor-pointer transition-colors"
      style={{
        gap: '6px',
        padding: '6px 8px',
        fontSize: '11px',
        borderRadius: '5px',
        border: 'none',
        backgroundColor: 'transparent',
        color: muted ? 'var(--color-text-tertiary)' : selected ? 'var(--clay)' : 'var(--color-text-secondary)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <span className="flex-1" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {children}
      </span>
      {selected && <Check size={11} style={{ flexShrink: 0, color: 'var(--clay)' }} />}
    </button>
  );
}
