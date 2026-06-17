import { useState } from 'react';
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
import { sortTodos, isOverdue, isDueToday, localDateKey } from '../lib/utils';
import { TodoCard } from './TodoCard';

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {overdue.length > 0 && (
          <section>
            <TodaySectionHead color="#e5484d" label={t('app.todayOverdue')} count={overdue.length} />
            {overdue.map((todo) => <TodoCard key={todo.id} todo={todo} />)}
          </section>
        )}
        {dueToday.length > 0 && (
          <section>
            <TodaySectionHead color="var(--color-accent)" label={t('app.todayDue')} count={dueToday.length} />
            {dueToday.map((todo) => <TodoCard key={todo.id} todo={todo} />)}
          </section>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 临时待办 */}
      {showActive && (
        <section>
          <SectionHead dot="#9C958C" label={t('app.quick')} count={quickTodos.length} />
          {quickTodos.length > 0 ? (
            manualEnabled
              ? <ManualSortableList todos={quickTodos} />
              : quickTodos.map((todo) => <TodoCard key={todo.id} todo={todo} />)
          ) : (
            <div style={{ padding: '14px 0 4px', textAlign: 'center', fontSize: 13, color: 'var(--ink-4)' }}>
              {t('app.noActiveTasks')}
            </div>
          )}
        </section>
      )}

      {/* 长时待办 */}
      {showActive && (
        <section>
          <SectionHead dot="var(--color-accent)" label={t('app.longterm')} count={longtermTodos.length} note={t('app.sortedBy')} />
          {longtermTodos.length > 0 ? (
            manualEnabled
              ? <ManualSortableList todos={longtermTodos} />
              : longtermTodos.map((todo) => <TodoCard key={todo.id} todo={todo} />)
          ) : (
            <div style={{ padding: '14px 0 4px', textAlign: 'center', fontSize: 13, color: 'var(--ink-4)' }}>
              {t('app.noActiveTasks')}
            </div>
          )}
        </section>
      )}

      {/* 已完成 — 按天折叠展示 */}
      {showCompleted && completedGroups.length > 0 && (
        <section>
          <SectionHead dot="#6B6B6B" label={t('app.completed')} count={completedTodos.length} />
          {completedGroups.map((group) => (
            <DayGroup key={group.dateKey} group={group} />
          ))}
        </section>
      )}
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
    const day = localDateKey(new Date(ts));
    if (!map[day]) map[day] = [];
    map[day].push(todo);
  }
  const today = localDateKey();
  const yesterday = localDateKey(new Date(Date.now() - 86400000));
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
          height: '26px', padding: '0 var(--pad-x)', gap: '5px',
          backgroundColor: 'var(--color-section-bg)', border: 'none',
          borderTop: '0.5px solid var(--color-separator)',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-section-bg)'; }}
      >
        {expanded
          ? (
            <svg width="10" height="10" viewBox="0 0 10 10" style={{ color: 'var(--color-text-tertiary)', flexShrink: 0, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <path d="M3 3.5L5 6l2-2.5" />
            </svg>
          )
          : (
            <svg width="10" height="10" viewBox="0 0 10 10" style={{ color: 'var(--color-text-tertiary)', flexShrink: 0, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <path d="M4 3l2.5 2L4 7" />
            </svg>
          )
        }
        <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
          {group.label}
        </span>
        <span className="text-[10px] ml-auto" style={{ color: 'var(--color-text-tertiary)', opacity: 0.6 }}>
          {group.todos.length} 项
        </span>
      </button>

      {expanded && (
        <div className="linear-disclosure-body">
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
        </div>
      )}
    </div>
  );
}

// ── SectionHead (Linear 风格) ─────────────────────────────────────────

function SectionHead({ dot, label, count, note }: { dot: string; label: string; count: number; note?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px var(--pad-x)' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', letterSpacing: 0.1, whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span className="linear-count-badge" style={{ fontSize: 12.5 }}>
        {count} 项
      </span>
      {note && (
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-4)' }}>
          {note}
        </span>
      )}
    </div>
  );
}

// ── Today 子视图 SectionHead ──────────────────────────────────────────

function TodaySectionHead({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px var(--pad-x)' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', letterSpacing: 0.1 }}>
        {label}
      </span>
      <span className="linear-count-badge" style={{ fontSize: 12.5 }}>
        {count} 项
      </span>
    </div>
  );
}

// ── 通用空状态 ────────────────────────────────────────────────────────

function EmptyText({ text }: { text: string }) {
  return (
    <p className="text-center select-none" style={{ padding: '12px 0', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
      {text}
    </p>
  );
}
