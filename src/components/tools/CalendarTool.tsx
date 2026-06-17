/**
 * CalendarTool — 日历视图（P2.1）
 *
 * 月视图显示当月 Todo 分布（参考 react-big-calendar 的月格交互，
 * 简化为：日期格 + 状态点 → 点击日期查看当日任务清单）。
 *  - coral 点：当日截止的未完成任务（过期未完成同样落在截止日）
 *  - olive 点：当日完成的任务（按 completionStore 时间戳）
 * 点击清单中的任务可直接勾选完成 / 取消。
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek,
  format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek,
} from 'date-fns';
import { useTodoStore, type Todo } from '../../store/todoStore';
import { useCompletionStore } from '../../store/completionStore';
import { useIsTouch } from '../../lib/responsive';

const WEEKDAYS_ZH = ['一', '二', '三', '四', '五', '六', '日'];
const WEEKDAYS_EN = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface DayBucket {
  due: Todo[];        // 当日截止、未完成
  done: Todo[];       // 当日完成
}

export function CalendarTool() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const isTouch = useIsTouch();
  const todos = useTodoStore((s) => s.todos);
  const toggleComplete = useTodoStore((s) => s.toggleComplete);
  const completionTimes = useCompletionStore((s) => s.completionTimes);

  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  // 月网格（周一开头，6 行定高）
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
    const all = eachDayOfInterval({ start, end });
    while (all.length < 42) all.push(addDays(all[all.length - 1], 1));
    return all;
  }, [viewMonth]);

  // 日期 → 任务桶（一次遍历，O(todos)）
  const buckets = useMemo(() => {
    const map = new Map<string, DayBucket>();
    const bucket = (key: string) => {
      let b = map.get(key);
      if (!b) { b = { due: [], done: [] }; map.set(key, b); }
      return b;
    };
    for (const todo of todos) {
      if (todo.completed) {
        const ts = completionTimes[todo.id];
        if (ts) bucket(format(new Date(ts), 'yyyy-MM-dd')).done.push(todo);
      } else if (todo.deadline) {
        bucket(format(new Date(todo.deadline), 'yyyy-MM-dd')).due.push(todo);
      }
    }
    return map;
  }, [todos, completionTimes]);

  const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');
  const selBucket = buckets.get(dayKey(selectedDay)) ?? { due: [], done: [] };
  const selList = [...selBucket.due, ...selBucket.done];

  const monthLabel = lang === 'zh' ? format(viewMonth, 'yyyy年M月') : format(viewMonth, 'MMMM yyyy');
  const weekdays = lang === 'zh' ? WEEKDAYS_ZH : WEEKDAYS_EN;
  const cell = isTouch ? 48 : 44;

  return (
    <div className="flex flex-col" style={{ gap: '14px' }}>
      {/* 月份导航 */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: '16px', fontWeight: 650, color: 'var(--color-text-primary)', letterSpacing: 'var(--tracking-tight)' }}>
          {monthLabel}
        </span>
        <div className="flex items-center" style={{ gap: '4px' }}>
          <CalNavBtn onClick={() => setViewMonth((m) => addMonths(m, -1))}><ChevronLeft size={14} /></CalNavBtn>
          <button
            onClick={() => { const now = new Date(); setViewMonth(startOfMonth(now)); setSelectedDay(now); }}
            className="cursor-pointer transition-colors"
            style={{
              height: '24px', padding: '0 10px', fontSize: '11px', borderRadius: '6px',
              border: '0.5px solid var(--color-border)', backgroundColor: 'transparent',
              color: 'var(--color-text-secondary)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--clay)'; e.currentTarget.style.color = 'var(--clay)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
          >
            {t('calendar.today')}
          </button>
          <CalNavBtn onClick={() => setViewMonth((m) => addMonths(m, 1))}><ChevronRight size={14} /></CalNavBtn>
        </div>
      </div>

      {/* 星期表头 + 月格 */}
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
          {weekdays.map((w) => (
            <span key={w} className="text-center" style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-tertiary)' }}>
              {w}
            </span>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
          {days.map((day) => {
            const inMonth = isSameMonth(day, viewMonth);
            const isSel = isSameDay(day, selectedDay);
            const today = isToday(day);
            const b = buckets.get(dayKey(day));
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDay(day)}
                className="cursor-pointer transition-colors flex flex-col items-center justify-center"
                style={{
                  height: cell,
                  gap: '3px',
                  borderRadius: '8px',
                  border: today && !isSel ? '1px solid var(--clay)' : '1px solid transparent',
                  backgroundColor: isSel ? 'var(--color-fill)' : 'transparent',
                  fontVariantNumeric: 'tabular-nums',
                }}
                onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <span style={{
                  fontSize: '14px',
                  fontWeight: isSel || today ? 600 : 400,
                  lineHeight: 1,
                  color: isSel
                    ? 'var(--color-fill-text)'
                    : !inMonth
                      ? 'var(--color-text-placeholder)'
                      : today
                        ? 'var(--clay)'
                        : 'var(--color-text-secondary)',
                }}>
                  {format(day, 'd')}
                </span>
                {/* 状态点 — 最多 3 个，超出以 + 表示 */}
                <span className="flex items-center" style={{ gap: '2px', height: '4px' }}>
                  {b && [
                    ...b.due.slice(0, 2).map((_, i) => <Dot key={`d${i}`} color="var(--clay)" inverted={isSel} />),
                    ...b.done.slice(0, 1).map((_, i) => <Dot key={`c${i}`} color="var(--olive)" inverted={isSel} />),
                  ]}
                  {b && b.due.length + b.done.length > 3 && (
                    <span style={{ fontSize: '9px', lineHeight: 1, color: isSel ? 'var(--color-fill-text)' : 'var(--color-text-tertiary)' }}>+</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 当日任务清单 */}
      <div className="flex flex-col" style={{ gap: '2px', borderTop: '0.5px solid var(--color-separator)', paddingTop: '12px', maxHeight: '280px', overflowY: 'auto' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: '6px', letterSpacing: '0.04em' }}>
          {selectedDay.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'long', day: 'numeric', weekday: lang === 'zh' ? 'short' : 'long' })}
          {selList.length > 0 && (
            <span style={{ fontWeight: 400, marginLeft: '6px' }}>· {selList.length}</span>
          )}
        </span>

        {selList.length === 0 ? (
          <div className="flex flex-col items-center" style={{ padding: '18px 0', gap: '6px' }}>
            <CalendarDays size={18} strokeWidth={1.5} style={{ color: 'var(--color-text-placeholder)' }} />
            <span style={{ fontSize: '13px', color: 'var(--color-text-tertiary)' }}>{t('calendar.noTasks')}</span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {selList.map((todo) => (
              <motion.div
                key={todo.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="flex items-center"
                style={{
                  minHeight: isTouch ? '44px' : '36px',
                  gap: '10px',
                  padding: '6px 10px',
                  borderRadius: '7px',
                }}
              >
                <button
                  onClick={() => toggleComplete(todo.id).catch(console.error)}
                  className="flex items-center justify-center flex-shrink-0 cursor-pointer"
                  style={{
                    width: '18px', height: '18px', borderRadius: '50%',
                    border: '2px solid',
                    borderColor: todo.completed ? 'var(--clay)' : 'var(--color-checkbox-border)',
                    backgroundColor: todo.completed ? 'var(--clay)' : 'transparent',
                    transition: 'background-color var(--transition-fast), border-color var(--transition-fast)',
                  }}
                >
                  {todo.completed && (
                    <svg width="10" height="8" viewBox="0 0 9 7" fill="none">
                      <path d="M1 3.5L3.2 5.8L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span
                  className="flex-1"
                  style={{
                    fontSize: '13.5px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: todo.completed ? 'var(--color-text-done)' : 'var(--color-text-primary)',
                    textDecoration: todo.completed ? 'line-through' : 'none',
                  }}
                >
                  {todo.title}
                </span>
                {todo.deadline && !todo.completed && (
                  <span style={{
                    fontSize: '12px', color: 'var(--color-text-tertiary)', flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {format(new Date(todo.deadline), 'HH:mm')}
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function Dot({ color, inverted }: { color: string; inverted: boolean }) {
  return (
    <span style={{
      width: '5px', height: '5px', borderRadius: '50%',
      backgroundColor: inverted ? 'var(--color-fill-text)' : color,
      display: 'inline-block',
    }} />
  );
}

function CalNavBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center cursor-pointer transition-colors"
      style={{
        width: '24px', height: '24px', borderRadius: '6px',
        border: 'none', backgroundColor: 'transparent',
        color: 'var(--color-text-tertiary)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
    >
      {children}
    </button>
  );
}
