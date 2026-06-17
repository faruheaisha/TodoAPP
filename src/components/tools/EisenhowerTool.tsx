/**
 * EisenhowerTool — 艾森豪威尔四象限 v2
 *
 * 新增：
 *  - @dnd-kit/core 拖拽：可把任务拖到任意象限
 *  - 拖拽落点更新 priority（重要轴）+ manualQuadrant（紧急轴覆盖）
 *  - 象限标题变大 + emoji 增添视觉活力
 *
 * 参考项目（⭐5000+）：
 *  - dnd-kit/dnd-kit (⭐14k): headless drag-and-drop toolkit
 *  - TickTick 四象限视图交互模式
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useTodoStore, type Todo } from '../../store/todoStore';
import { useQuadrantStore, type QuadrantId } from '../../store/quadrantStore';
import { isOverdue, isUrgent, isDueToday } from '../../lib/utils';

interface QuadrantMeta {
  id: QuadrantId;
  color: string;
  bgColor: string;
  emoji: string;
  titleZh: string;
  titleEn: string;
  actionZh: string;
  actionEn: string;
}

const QUADRANTS: QuadrantMeta[] = [
  {
    id: 'q1',
    color: '#D97757',
    bgColor: 'rgba(217,119,87,0.07)',
    emoji: '🔥',
    titleZh: '重要 · 紧急',
    titleEn: 'Important · Urgent',
    actionZh: '立刻做',
    actionEn: 'Do Now',
  },
  {
    id: 'q2',
    color: '#6A9F7D',
    bgColor: 'rgba(106,159,125,0.07)',
    emoji: '📅',
    titleZh: '重要 · 不紧急',
    titleEn: 'Important · Not Urgent',
    actionZh: '安排时间',
    actionEn: 'Schedule',
  },
  {
    id: 'q3',
    color: '#B8946C',
    bgColor: 'rgba(184,148,108,0.07)',
    emoji: '⚡',
    titleZh: '不重要 · 紧急',
    titleEn: 'Not Important · Urgent',
    actionZh: '委托他人',
    actionEn: 'Delegate',
  },
  {
    id: 'q4',
    color: '#8C8A87',
    bgColor: 'rgba(140,138,135,0.06)',
    emoji: '🗑️',
    titleZh: '不重要 · 不紧急',
    titleEn: 'Not Important · Not Urgent',
    actionZh: '有空再说',
    actionEn: 'Eliminate',
  },
];

function quadrantToPriority(q: QuadrantId, currentPriority: number): number {
  if (q === 'q1' || q === 'q2') {
    return Math.max(currentPriority, 2);
  } else {
    return Math.min(currentPriority <= 1 ? currentPriority : 1, 1);
  }
}

const isImportant = (t: Todo) => t.priority >= 2;
const isUrgentNow = (t: Todo) => isOverdue(t) || isUrgent(t) || isDueToday(t);

// ─── 可拖拽的任务条目 ─────────────────────────────────────────────────────────
function DraggableTodo({
  todo,
  meta,
  onToggle,
  lang,
  isDraggingThis,
}: {
  todo: Todo;
  meta: QuadrantMeta;
  onToggle: (id: string) => void;
  lang: string;
  isDraggingThis?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: todo.id,
    data: { todo },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDraggingThis ? 0.35 : 1,
    touchAction: 'none',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <button
        onClick={() => onToggle(todo.id)}
        className="w-full flex items-center text-left transition-colors"
        style={{
          gap: '7px', padding: '5px 7px', borderRadius: '6px',
          border: 'none', backgroundColor: 'transparent',
          cursor: 'grab',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-secondary)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        title={lang === 'zh' ? '点击完成 / 拖拽移动' : 'Click to complete · Drag to move'}
      >
        <span
          style={{
            width: '13px', height: '13px', borderRadius: '50%',
            border: `1.5px solid ${meta.color}`,
            flexShrink: 0, display: 'inline-block',
          }}
        />
        <span
          style={{
            fontSize: '11px', color: 'var(--color-text-secondary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1, userSelect: 'none',
          }}
        >
          {todo.title}
        </span>
      </button>
    </div>
  );
}

// ─── 可放置的象限格 ──────────────────────────────────────────────────────────
function DroppableQuadrant({
  meta,
  lang,
  todos,
  onToggle,
  activeId,
}: {
  meta: QuadrantMeta;
  lang: string;
  todos: Todo[];
  onToggle: (id: string) => void;
  activeId: string | null;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: meta.id });

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col"
      style={{
        borderRadius: '12px',
        border: `1.5px solid ${isOver ? meta.color : 'var(--color-border)'}`,
        borderTop: `3px solid ${meta.color}`,
        backgroundColor: isOver ? meta.bgColor : 'var(--color-bg-tertiary)',
        overflow: 'hidden',
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
    >
      {/* 象限标题 */}
      <div
        className="flex items-start justify-between flex-shrink-0"
        style={{ padding: '10px 11px 7px' }}
      >
        <div className="flex flex-col" style={{ gap: '3px' }}>
          <div className="flex items-center" style={{ gap: '5px' }}>
            <span style={{ fontSize: '14px', lineHeight: 1 }}>{meta.emoji}</span>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: meta.color,
                letterSpacing: '-0.01em',
              }}
            >
              {lang === 'zh' ? meta.titleZh : meta.titleEn}
            </span>
          </div>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: meta.color,
              opacity: 0.7,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              paddingLeft: '19px',
            }}
          >
            {lang === 'zh' ? meta.actionZh : meta.actionEn}
          </span>
        </div>
        {todos.length > 0 && (
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: meta.color,
              background: meta.bgColor,
              borderRadius: '8px',
              padding: '1px 7px',
              flexShrink: 0,
              marginTop: '2px',
            }}
          >
            {todos.length}
          </span>
        )}
      </div>

      {/* 任务列表 */}
      <div
        className="tools-scroll flex-1 overflow-y-auto"
        style={{
          padding: '0 6px 8px',
          display: 'flex', flexDirection: 'column', gap: '1px',
          minHeight: '50px',
        }}
      >
        {todos.length === 0 ? (
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: '60px', fontSize: '12px',
              color: 'var(--color-text-tertiary)', opacity: 0.45,
              userSelect: 'none',
            }}
          >
            {isOver
              ? (lang === 'zh' ? '放到这里' : 'Drop here')
              : (lang === 'zh' ? '暂无任务，从左侧拖拽或添加待办' : 'No tasks. Drag or add from the left')}
          </div>
        ) : (
          todos.map((todo) => (
            <DraggableTodo
              key={todo.id}
              todo={todo}
              meta={meta}
              onToggle={onToggle}
              lang={lang}
              isDraggingThis={todo.id === activeId}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────
export function EisenhowerTool() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';

  const todos = useTodoStore((s) => s.todos);
  const toggleComplete = useTodoStore((s) => s.toggleComplete);
  const setPriority = useTodoStore((s) => s.setPriority);

  const { overrides, setOverride } = useQuadrantStore();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const buckets = useMemo(() => {
    const map: Record<QuadrantId, Todo[]> = { q1: [], q2: [], q3: [], q4: [] };
    for (const todo of todos) {
      if (todo.completed) continue;
      if (overrides[todo.id]) {
        map[overrides[todo.id]].push(todo);
        continue;
      }
      const important = isImportant(todo);
      const urgent = isUrgentNow(todo);
      const id: QuadrantId = important ? (urgent ? 'q1' : 'q2') : (urgent ? 'q3' : 'q4');
      map[id].push(todo);
    }
    return map;
  }, [todos, overrides]);

  const activeTodo = useMemo(
    () => (activeId ? todos.find((t) => t.id === activeId) ?? null : null),
    [activeId, todos]
  );

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;

    const todoId = String(active.id);
    const targetQ = over.id as QuadrantId;
    const todo = todos.find((t) => t.id === todoId);
    if (!todo) return;

    const currentQ: QuadrantId = overrides[todoId] ?? (
      isImportant(todo)
        ? (isUrgentNow(todo) ? 'q1' : 'q2')
        : (isUrgentNow(todo) ? 'q3' : 'q4')
    );
    if (currentQ === targetQ) return;

    const newPriority = quadrantToPriority(targetQ, todo.priority);
    if (newPriority !== todo.priority) {
      setPriority(todoId, newPriority as import('../../store/todoStore').Priority).catch(console.error);
    }
    setOverride(todoId, targetQ);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: '10px',
          minHeight: '500px',
        }}
      >
        {QUADRANTS.map((q) => (
          <DroppableQuadrant
            key={q.id}
            meta={q}
            lang={lang}
            todos={buckets[q.id]}
            onToggle={(id) => toggleComplete(id).catch(console.error)}
            activeId={activeId}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTodo && (
          <div
            style={{
              padding: '5px 10px',
              borderRadius: '6px',
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-md)',
              fontSize: '11px',
              color: 'var(--color-text-secondary)',
              cursor: 'grabbing',
              maxWidth: '180px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {activeTodo.title}
          </div>
        )}
        </DragOverlay>
    </DndContext>
  );
}
