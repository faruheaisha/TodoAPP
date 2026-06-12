import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTodoStore, type Todo } from '../store/todoStore';
import { useCompletionStore } from '../store/completionStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTagStore } from '../store/tagStore';
import { sortTodos, isOverdue, isDueToday } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { TodoCard } from './TodoCard';
import { ChevronDown, ChevronRight, AlertCircle, CalendarCheck } from 'lucide-react';

/**
 * 已完成任务折叠方案：
 * - 按「完成日期」分组（completionStore 记录，回退到 createdAt）
 * - 每组默认显示最新 10 条，超出可展开查看全部
 * - 当天组默认展开，更早的日期组默认折叠
 * - 参考 Things 3 Logbook + Todoist 归档的 UX 模式
 */

const MAX_VISIBLE_PER_GROUP = 10;

interface TodoSectionProps {
  filter?: 'today' | 'all' | 'active' | 'completed';
  tagFilter?: string | null;
}

export default function TodoSection({ filter = 'all', tagFilter = null }: TodoSectionProps) {
  const { t } = useTranslation();
  const { todos } = useTodoStore();
  const completionTimes = useCompletionStore((s) => s.completionTimes);
  const todoTags = useTagStore((s) => s.todoTags);

  // 按标签过滤
  const filterByTag = (list: Todo[]) => {
    if (!tagFilter) return list;
    return list.filter(td => (todoTags[td.id] ?? []).includes(tagFilter));
  };

  // 今日视图：跨临时/长时的智能列表 —— 逾期 + 今日到期
  if (filter === 'today') {
    const pool = filterByTag(todos.filter((td) => !td.completed));
    const overdue = sortTodos(pool.filter(isOverdue));
    const dueToday = sortTodos(pool.filter((td) => isDueToday(td) && !isOverdue(td)));

    if (overdue.length === 0 && dueToday.length === 0) {
      return <EmptyText text={t('app.todayEmpty')} />;
    }

    return (
      <div>
        {overdue.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <SectionHeader color="#e5484d" label={t('app.todayOverdue')} count={overdue.length} suffix={t('app.items')} icon={<AlertCircle size={11} style={{ color: '#e5484d' }} />} />
            {overdue.map((todo) => <TodoCard key={todo.id} todo={todo} />)}
          </motion.section>
        )}
        {dueToday.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: overdue.length > 0 ? '6px' : 0 }}>
            <SectionHeader color="var(--color-accent)" label={t('app.todayDue')} count={dueToday.length} suffix={t('app.items')} icon={<CalendarCheck size={11} style={{ color: 'var(--color-accent)' }} />} />
            {dueToday.map((todo) => <TodoCard key={todo.id} todo={todo} />)}
          </motion.section>
        )}
      </div>
    );
  }

  const activeTodos = filterByTag(todos.filter((td) => !td.completed));
  const completedTodos = filterByTag(todos.filter((td) => td.completed));

  // 按 filter 决定显示什么
  const showActive = filter === 'all' || filter === 'active';
  const showCompleted = filter === 'all' || filter === 'completed';

  // 分类 active todos（manual 模式按用户拖拽的 sortOrder）
  const sortMode = useSettingsStore((s) => s.sortMode);
  const sorted = sortTodos(activeTodos, sortMode);
  const quickTodos = sorted.filter((t) => t.todoType === 'quick');
  const longtermTodos = sorted.filter((t) => t.todoType === 'longterm');
  // 标签过滤时禁用拖拽：过滤视图下的局部重排会产生反直觉的全局次序
  const manualEnabled = sortMode === 'manual' && !tagFilter;

  // 按天分组 completed todos，newest first
  const completedGroups = groupByDay(completedTodos, completionTimes);

  return (
    <div>
      {/* 临时待办 */}
      <AnimatePresence>
        {showActive && (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <SectionHeader
              color="var(--color-text-tertiary)"
              label={t('app.quick')}
              count={quickTodos.length}
              suffix={t('app.items')}
            />
            {quickTodos.length > 0 ? (
              manualEnabled
                ? <ManualSortableList todos={quickTodos} />
                : quickTodos.map((todo) => <TodoCard key={todo.id} todo={todo} />)
            ) : (
              <EmptyText text={t('app.noActiveTasks')} />
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* 长时待办 */}
      <AnimatePresence>
        {showActive && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ marginTop: '6px' }}
          >
            <SectionHeader
              color="var(--color-accent)"
              label={t('app.longterm')}
              count={longtermTodos.length}
              suffix={t('app.items') + ' ' + t('app.sortedBy')}
            />
            {longtermTodos.length > 0 ? (
              manualEnabled
                ? <ManualSortableList todos={longtermTodos} />
                : longtermTodos.map((todo) => <TodoCard key={todo.id} todo={todo} />)
            ) : (
              <EmptyText text={t('app.noActiveTasks')} />
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* 已完成 — 按天折叠展示 */}
      <AnimatePresence>
        {showCompleted && completedGroups.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ marginTop: showActive ? '10px' : 0 }}
          >
            <SectionHeader
              color="var(--color-text-tertiary)"
              label={t('app.completed')}
              count={completedTodos.length}
              suffix={t('app.items')}
            />
            {completedGroups.map((group) => (
              <DayGroup key={group.dateKey} group={group} />
            ))}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 手动拖拽排序（manual 模式）──────────────────────────────────────────
// quick / longterm 两段各自一个 DndContext，拖拽只在分区内进行。
// PointerSensor 设 5px 启动阈值：保证行内按钮的点击不被吞掉。

function ManualSortableList({ todos }: { todos: Todo[] }) {
  const reorderTodos = useTodoStore((s) => s.reorderTodos);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = todos.map((t) => t.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    reorderTodos(arrayMove(ids, oldIndex, newIndex)).catch(console.error);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {todos.map((todo) => (
          <SortableTodoCard key={todo.id} todo={todo} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableTodoCard({ todo }: { todo: Todo }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
        position: 'relative',
        zIndex: isDragging ? 50 : undefined,
        cursor: isDragging ? 'grabbing' : undefined,
        touchAction: 'manipulation',
      }}
    >
      <TodoCard todo={todo} />
    </div>
  );
}

// ── 按天分组 ──────────────────────────────────────────────────────────

interface DayGroupData {
  dateKey: string;
  label: string;
  isToday: boolean;
  todos: Todo[];
}

function groupByDay(todos: Todo[], completionTimes: Record<string, string>): DayGroupData[] {
  const map: Record<string, Todo[]> = {};
  for (const todo of todos) {
    const ts = completionTimes[todo.id] ?? todo.createdAt;
    const day = ts.slice(0, 10);
    if (!map[day]) map[day] = [];
    map[day].push(todo);
  }
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  return Object.keys(map)
    .sort()
    .reverse()
    .map((dateKey) => ({
      dateKey,
      label: dateKey === today ? '今天' : dateKey === yesterday ? '昨天' : formatDayLabel(dateKey),
      isToday: dateKey === today,
      todos: map[dateKey],
    }));
}

function formatDayLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

// ── 天分组折叠组件 ────────────────────────────────────────────────────

function DayGroup({ group }: { group: DayGroupData }) {
  const [expanded, setExpanded] = useState(group.isToday);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? group.todos : group.todos.slice(0, MAX_VISIBLE_PER_GROUP);
  const hiddenCount = group.todos.length - MAX_VISIBLE_PER_GROUP;

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center cursor-pointer transition-colors"
        style={{
          height: '26px', padding: '0 14px', gap: '5px',
          backgroundColor: 'var(--color-section-bg)', border: 'none',
          borderTop: '0.5px solid var(--color-separator)',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-section-bg)'; }}
      >
        {expanded
          ? <ChevronDown size={10} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
          : <ChevronRight size={10} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
        }
        <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
          {group.label}
        </span>
        <span className="text-[10px] ml-auto" style={{ color: 'var(--color-text-tertiary)', opacity: 0.6 }}>
          {group.todos.length} 项
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            {visible.map((todo) => <TodoCard key={todo.id} todo={todo} />)}
            {!showAll && hiddenCount > 0 && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full text-center text-[11px] py-1.5 transition-colors cursor-pointer"
                style={{
                  color: 'var(--clay)', backgroundColor: 'transparent', border: 'none',
                  borderTop: '0.5px solid var(--color-separator)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
              >
                查看更多 {hiddenCount} 项 ↓
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 通用子组件 ────────────────────────────────────────────────────────

function SectionHeader({ color, label, count, suffix, icon }: { color: string; label: string; count: number; suffix: string; icon?: ReactNode }) {
  return (
    <div
      className="flex items-center flex-shrink-0"
      style={{ height: 'var(--section-header-h)', padding: '5px var(--pad-x) 3px', gap: '5px', backgroundColor: 'var(--color-section-bg)' }}
    >
      {icon ?? <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />}
      <h2 className="text-[10px] font-medium uppercase tracking-wider select-none" style={{ color: 'var(--color-text-secondary)', letterSpacing: '.03em' }}>
        {label}
      </h2>
      <span className="text-[10px] ml-auto select-none" style={{ color: 'var(--color-text-tertiary)' }}>
        {count} {suffix}
      </span>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <p className="text-center select-none" style={{ padding: '12px var(--pad-x)', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
      {text}
    </p>
  );
}
