/**
 * DatePicker — Anthropic 风格日期时间选择弹层
 *
 * 替代原生 datetime-local 的 showPicker()（视觉无法定制、跨端不一致）。
 * 结构参考 react-day-picker 的月视图交互，视觉完全走设计 token：
 *   快捷预设（今晚/明天/下周一）→ 月历网格 → 时间行 → 清除/完成
 * 值格式与 datetime-local 兼容：YYYY-MM-DDTHH:mm
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek,
  format, isSameDay, isSameMonth, isToday, nextMonday,
  setHours, setMinutes, startOfMonth, startOfWeek,
} from 'date-fns';
import { useIsTouch } from '../lib/responsive';

interface DatePickerProps {
  /** datetime-local 格式 YYYY-MM-DDTHH:mm，空串表示未选 */
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  lang: 'zh' | 'en';
}

const WEEKDAYS_ZH = ['一', '二', '三', '四', '五', '六', '日'];
const WEEKDAYS_EN = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function toLocalInputValue(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export default function DatePicker({ value, onChange, onClose, lang }: DatePickerProps) {
  const isTouch = useIsTouch();
  const selected = value ? new Date(value) : null;
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected ?? new Date()));
  const [time, setTime] = useState(() => (selected ? format(selected, 'HH:mm') : '09:00'));

  const cell = isTouch ? 36 : 27;
  const weekdays = lang === 'zh' ? WEEKDAYS_ZH : WEEKDAYS_EN;

  // 周一开头的整月网格（6 行补齐，避免月份切换高度跳动）
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
    const all = eachDayOfInterval({ start, end });
    while (all.length < 42) all.push(addDays(all[all.length - 1], 1));
    return all;
  }, [viewMonth]);

  const applyDate = (day: Date) => {
    const [hh, mm] = time.split(':').map(Number);
    onChange(toLocalInputValue(setMinutes(setHours(day, hh || 0), mm || 0)));
  };

  const applyTime = (next: string) => {
    setTime(next);
    if (selected) {
      const [hh, mm] = next.split(':').map(Number);
      onChange(toLocalInputValue(setMinutes(setHours(selected, hh || 0), mm || 0)));
    }
  };

  // 预设直接带时间应用（绕过 time state 的异步更新）
  const applyDateWithTime = (d: Date) => onChange(toLocalInputValue(d));

  const presets: { label: string; get: () => Date }[] = [
    {
      label: lang === 'zh' ? '今晚' : 'Tonight',
      get: () => setMinutes(setHours(new Date(), 21), 0),
    },
    {
      label: lang === 'zh' ? '明天' : 'Tomorrow',
      get: () => setMinutes(setHours(addDays(new Date(), 1), 9), 0),
    },
    {
      label: lang === 'zh' ? '下周一' : 'Next Mon',
      get: () => setMinutes(setHours(nextMonday(new Date()), 9), 0),
    },
  ];

  const monthLabel = lang === 'zh'
    ? format(viewMonth, 'yyyy年M月')
    : format(viewMonth, 'MMMM yyyy');

  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -2, scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
      style={{
        position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 120,
        width: isTouch ? 296 : 252,
        borderRadius: '10px',
        border: '0.5px solid var(--color-border)',
        backgroundColor: 'var(--color-bg-primary)',
        boxShadow: 'var(--shadow-md)',
        padding: '10px',
        userSelect: 'none',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 快捷预设 */}
      <div className="flex" style={{ gap: '5px', marginBottom: '10px' }}>
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => { const d = p.get(); setViewMonth(startOfMonth(d)); setTime(format(d, 'HH:mm')); applyDateWithTime(d); }}
            className="flex-1 cursor-pointer transition-colors"
            style={{
              height: isTouch ? '32px' : '24px',
              fontSize: '11px',
              borderRadius: '6px',
              border: '0.5px solid var(--color-border)',
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--clay)'; e.currentTarget.style.color = 'var(--clay)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 月份导航 */}
      <div className="flex items-center justify-between" style={{ marginBottom: '6px', padding: '0 2px' }}>
        <NavBtn onClick={() => setViewMonth((m) => addMonths(m, -1))} touch={isTouch}>
          <ChevronLeft size={14} />
        </NavBtn>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: 'var(--tracking-normal)' }}>
          {monthLabel}
        </span>
        <NavBtn onClick={() => setViewMonth((m) => addMonths(m, 1))} touch={isTouch}>
          <ChevronRight size={14} />
        </NavBtn>
      </div>

      {/* 星期表头 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '2px' }}>
        {weekdays.map((w) => (
          <span key={w} className="text-center" style={{ fontSize: '9px', fontWeight: 500, color: 'var(--color-text-tertiary)', height: '18px', lineHeight: '18px' }}>
            {w}
          </span>
        ))}
      </div>

      {/* 日期网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px' }}>
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewMonth);
          const isSel = selected ? isSameDay(day, selected) : false;
          const today = isToday(day);
          return (
            <button
              key={day.toISOString()}
              onClick={() => applyDate(day)}
              className="cursor-pointer transition-colors"
              style={{
                height: cell,
                fontSize: '11px',
                borderRadius: '6px',
                border: today && !isSel ? '1px solid var(--clay)' : '1px solid transparent',
                backgroundColor: isSel ? 'var(--clay)' : 'transparent',
                color: isSel
                  ? '#fff'
                  : !inMonth
                    ? 'var(--color-text-placeholder)'
                    : today
                      ? 'var(--clay)'
                      : 'var(--color-text-secondary)',
                fontWeight: isSel || today ? 600 : 400,
                fontVariantNumeric: 'tabular-nums',
              }}
              onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'; }}
              onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      {/* 时间行 */}
      <div
        className="flex items-center"
        style={{
          marginTop: '8px', paddingTop: '8px', gap: '7px',
          borderTop: '0.5px solid var(--color-separator)',
        }}
      >
        <Clock size={12} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
        <input
          type="time"
          value={time}
          onChange={(e) => applyTime(e.target.value)}
          style={{
            flex: 1,
            height: isTouch ? '34px' : '26px',
            fontSize: '12px',
            padding: '0 8px',
            borderRadius: '6px',
            border: '0.5px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-input)',
            color: 'var(--color-text-primary)',
            outline: 'none',
            fontVariantNumeric: 'tabular-nums',
            colorScheme: 'light dark',
          }}
        />
      </div>

      {/* 底部操作 */}
      <div className="flex" style={{ gap: '6px', marginTop: '8px' }}>
        <button
          onClick={() => { onChange(''); onClose(); }}
          className="flex-1 cursor-pointer transition-colors"
          style={{
            height: isTouch ? '34px' : '26px', fontSize: '11px', borderRadius: '6px',
            border: '0.5px solid var(--color-border)', backgroundColor: 'transparent',
            color: 'var(--color-text-tertiary)',
          }}
        >
          {lang === 'zh' ? '清除' : 'Clear'}
        </button>
        <button
          onClick={onClose}
          className="flex-1 cursor-pointer transition-colors"
          style={{
            height: isTouch ? '34px' : '26px', fontSize: '11px', fontWeight: 600, borderRadius: '6px',
            border: 'none', backgroundColor: 'var(--clay)', color: '#fff',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--clay-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--clay)'; }}
        >
          {lang === 'zh' ? '完成' : 'Done'}
        </button>
      </div>
    </motion.div>
  );
}

function NavBtn({ onClick, children, touch }: { onClick: () => void; children: React.ReactNode; touch: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center cursor-pointer transition-colors"
      style={{
        width: touch ? '32px' : '24px', height: touch ? '32px' : '24px',
        borderRadius: '6px', border: 'none', backgroundColor: 'transparent',
        color: 'var(--color-text-tertiary)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
    >
      {children}
    </button>
  );
}
