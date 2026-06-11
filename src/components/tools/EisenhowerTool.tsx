/**
 * EisenhowerTool — 艾森豪威尔四象限（P0）
 *
 * 决策视图：把未完成任务按「重要 × 紧急」自动归入四象限，
 * 帮用户判断「先做什么」，而不仅是记录。
 *
 * 维度派生自现有数据，零额外存储：
 *  - 重要 = priority ≥ 2（中/高）
 *  - 紧急 = 已逾期 或 24h 内到期 或 今天到期
 * 调整任务优先级（在列表或卡片上）即可让它在象限间移动，形成闭环。
 * 参考 TickTick 四象限的行动语义：Do / Plan / Delegate / Eliminate。
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTodoStore, type Todo } from '../../store/todoStore';
import { isOverdue, isUrgent, isDueToday } from '../../lib/utils';

type QuadrantId = 'q1' | 'q2' | 'q3' | 'q4';

interface QuadrantMeta {
  id: QuadrantId;
  color: string;
  titleZh: string;
  titleEn: string;
  actionZh: string;
  actionEn: string;
}

const QUADRANTS: QuadrantMeta[] = [
  { id: 'q1', color: '#e5484d', titleZh: '重要 · 紧急', titleEn: 'Important · Urgent', actionZh: '立刻做', actionEn: 'Do first' },
  { id: 'q2', color: '#6a9bcc', titleZh: '重要 · 不紧急', titleEn: 'Important · Not urgent', actionZh: '安排时间', actionEn: 'Schedule' },
  { id: 'q3', color: '#f59e0b', titleZh: '不重要 · 紧急', titleEn: 'Not important · Urgent', actionZh: '尽快处理', actionEn: 'Handle soon' },
  { id: 'q4', color: 'var(--color-text-tertiary)', titleZh: '不重要 · 不紧急', titleEn: 'Not important · Not urgent', actionZh: '有空再说', actionEn: 'Later' },
];

const isImportant = (t: Todo) => t.priority >= 2;
const isUrgentNow = (t: Todo) => isOverdue(t) || isUrgent(t) || isDueToday(t);

export function EisenhowerTool() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const todos = useTodoStore((s) => s.todos);
  const toggleComplete = useTodoStore((s) => s.toggleComplete);

  const buckets = useMemo(() => {
    const map: Record<QuadrantId, Todo[]> = { q1: [], q2: [], q3: [], q4: [] };
    for (const todo of todos) {
      if (todo.completed) continue;
      const important = isImportant(todo);
      const urgent = isUrgentNow(todo);
      const id: QuadrantId = important ? (urgent ? 'q1' : 'q2') : (urgent ? 'q3' : 'q4');
      map[id].push(todo);
    }
    return map;
  }, [todos]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '10px',
        minHeight: '380px',
      }}
    >
      {QUADRANTS.map((q) => (
        <Quadrant
          key={q.id}
          meta={q}
          lang={lang}
          todos={buckets[q.id]}
          onToggle={(id) => toggleComplete(id).catch(console.error)}
        />
      ))}
    </div>
  );
}

function Quadrant({
  meta, lang, todos, onToggle,
}: {
  meta: QuadrantMeta;
  lang: 'zh' | 'en';
  todos: Todo[];
  onToggle: (id: string) => void;
}) {
  return (
    <div
      className="flex flex-col"
      style={{
        borderRadius: '10px',
        border: '0.5px solid var(--color-border)',
        borderTop: `2px solid ${meta.color}`,
        backgroundColor: 'var(--color-bg-tertiary)',
        overflow: 'hidden',
      }}
    >
      {/* 象限标题 */}
      <div className="flex items-center justify-between flex-shrink-0" style={{ padding: '8px 10px 6px' }}>
        <div className="flex flex-col" style={{ gap: '1px' }}>
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {lang === 'zh' ? meta.titleZh : meta.titleEn}
          </span>
          <span style={{ fontSize: '8px', color: meta.color, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {lang === 'zh' ? meta.actionZh : meta.actionEn}
          </span>
        </div>
        {todos.length > 0 && (
          <span style={{ fontSize: '9px', color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
            {todos.length}
          </span>
        )}
      </div>

      {/* 任务列表 */}
      <div className="tools-scroll flex-1 overflow-y-auto" style={{ padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {todos.length === 0 ? (
          <div className="flex items-center justify-center flex-1" style={{ minHeight: '40px', fontSize: '9px', color: 'var(--color-text-tertiary)', opacity: 0.6 }}>
            {lang === 'zh' ? '空' : 'Empty'}
          </div>
        ) : (
          todos.map((todo) => (
            <button
              key={todo.id}
              onClick={() => onToggle(todo.id)}
              className="w-full flex items-center text-left cursor-pointer transition-colors"
              style={{
                gap: '6px', padding: '4px 6px', borderRadius: '5px',
                border: 'none', backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-secondary)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              title={lang === 'zh' ? '点击标记完成' : 'Click to complete'}
            >
              <span
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: '12px', height: '12px', borderRadius: '50%', border: `1.5px solid ${meta.color}` }}
              />
              <span
                className="flex-1"
                style={{ fontSize: '11px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {todo.title}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
