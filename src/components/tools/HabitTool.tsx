/**
 * HabitTool — 习惯打卡工具
 *
 * UI 设计参考 Loop Habit Tracker (GitHub ⭐9.9k, iSoron/uhabits) 的核心交互模式：
 *   - 每个习惯行展示最近 7 天的可点击打卡圆圈（今日高亮、已打卡填充、未打卡描边）
 *   - 连续天数（Streak）实时显示，使用 Loop 的宽容算法（今日未打卡不清零）
 *   - 颜色分组借鉴 Habitica (GitHub ⭐13.9k) 的视觉分类体系
 * 适配：Anthropic clay/olive/sky/fig 四色设计 token + Framer Motion spring 动画
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Flame } from 'lucide-react';
import {
  useHabitStore,
  HABIT_COLORS,
  calcStreak,
  toDateKey,
  type HabitColor,
} from '../../store/habitStore';

const COLOR_OPTIONS: HabitColor[] = ['clay', 'olive', 'sky', 'fig'];
const GRID_DAYS = 7;

/** 生成最近 7 天的日期信息，含当天标识与本地化短标签 */
function useDayGrid(lang: string) {
  const today = new Date();
  const todayKey = toDateKey(today);
  const zhLabels = ['日', '一', '二', '三', '四', '五', '六'];
  const enLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return Array.from({ length: GRID_DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (GRID_DAYS - 1 - i));
    const key = toDateKey(d);
    const label = lang === 'zh' ? zhLabels[d.getDay()] : enLabels[d.getDay()];
    return { key, label, isToday: key === todayKey };
  });
}

/** 单个打卡圆圈（Loop Habit Tracker 核心视觉元素，适配 Framer Motion） */
function CheckCircle({
  checked,
  color,
  isToday,
  onToggle,
}: {
  checked: boolean;
  color: string;
  isToday: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.78 }}
      className="cursor-pointer flex-shrink-0"
      style={{ width: 24, height: 24, padding: 0, background: 'none', border: 'none' }}
    >
      <motion.div
        initial={false}
        animate={{ scale: checked ? 1 : 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 22 }}
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          backgroundColor: checked ? color : 'transparent',
          border: `1.5px solid ${checked ? color : isToday ? color : 'var(--color-border)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 'auto',
          opacity: isToday || checked ? 1 : 0.45,
          transition: 'background-color 0.15s, border-color 0.15s, opacity 0.15s',
        }}
      >
        <AnimatePresence>
          {checked && (
            <motion.svg
              key="check"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 520, damping: 24 }}
              width="11" height="11" viewBox="0 0 11 11" fill="none"
            >
              <path
                d="M2.2 5.5l2.4 2.4L9 2.5"
                stroke="white"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.button>
  );
}

export function HabitTool() {
  const { t, i18n } = useTranslation();
  const { habits, addHabit, removeHabit, toggleCheckIn } = useHabitStore();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<HabitColor>('clay');

  const lang = i18n.language as 'zh' | 'en';
  const days = useDayGrid(lang);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    addHabit(name, newColor);
    setNewName('');
    setNewColor('clay');
    setShowAdd(false);
  };

  return (
    <div className="flex flex-col" style={{ gap: '14px' }}>

      {/* ── 顶部操作栏 ── */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-medium uppercase tracking-widest" style={{ color: 'var(--clay)' }}>
          {t('habits.subtitle')}
        </span>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-1 rounded-md text-xs font-medium transition-all cursor-pointer"
          style={{
            padding: '5px 10px',
            backgroundColor: showAdd ? 'var(--color-fill)' : 'transparent',
            color: showAdd ? 'var(--color-fill-text)' : 'var(--color-text-tertiary)',
            border: `0.5px solid ${showAdd ? 'transparent' : 'var(--color-border)'}`,
          }}
        >
          <Plus size={11} />
          {t('habits.add')}
        </button>
      </div>

      {/* ── 新增习惯表单 ── */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: -8 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: 10,
                border: '0.5px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-tertiary)',
              }}
            >
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                  if (e.key === 'Escape') { setShowAdd(false); setNewName(''); }
                }}
                placeholder={t('habits.namePlaceholder')}
                autoFocus
                className="text-xs outline-none bg-transparent"
                style={{ color: 'var(--color-text-primary)' }}
              />
              <div className="flex items-center justify-between">
                {/* 颜色选择器 — 参考 Habitica 的任务颜色分类体系 */}
                <div className="flex items-center" style={{ gap: '8px' }}>
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className="cursor-pointer transition-all"
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        backgroundColor: HABIT_COLORS[c],
                        transform: newColor === c ? 'scale(1.25)' : 'scale(1)',
                        boxShadow:
                          newColor === c
                            ? `0 0 0 2px var(--color-bg-secondary), 0 0 0 3.5px ${HABIT_COLORS[c]}`
                            : 'none',
                        border: 'none',
                        padding: 0,
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={handleAdd}
                  disabled={!newName.trim()}
                  className="rounded-md text-xs font-medium transition-all cursor-pointer"
                  style={{
                    padding: '5px 12px',
                    backgroundColor: newName.trim() ? 'var(--color-fill)' : 'var(--color-bg-secondary)',
                    color: newName.trim() ? 'var(--color-fill-text)' : 'var(--color-text-tertiary)',
                    border: 'none',
                    opacity: newName.trim() ? 1 : 0.5,
                  }}
                >
                  {t('habits.confirm')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 日期列标题（与习惯行的打卡圆圈列对齐）── */}
      {habits.length > 0 && (
        <div className="flex items-center" style={{ paddingRight: 28 }}>
          <div className="flex-1" />
          <div className="flex items-center" style={{ gap: '4px' }}>
            {days.map((d) => (
              <div
                key={d.key}
                style={{
                  width: 24,
                  textAlign: 'center',
                  fontSize: 9,
                  fontWeight: d.isToday ? 700 : 400,
                  color: d.isToday ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                }}
              >
                {d.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 习惯列表 ── */}
      <div className="flex flex-col" style={{ gap: '3px' }}>
        <AnimatePresence initial={false}>
          {habits.map((habit) => {
            const checkSet = new Set(habit.checkIns);
            const streak = calcStreak(checkSet);
            const color = HABIT_COLORS[habit.color];

            return (
              <motion.div
                key={habit.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="flex items-center rounded-lg group"
                style={{ padding: '6px 8px', gap: '8px', cursor: 'default' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                {/* 习惯色点 */}
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: color,
                    flexShrink: 0,
                  }}
                />

                {/* 习惯名 + streak */}
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <span
                    className="text-xs truncate"
                    style={{ color: 'var(--color-text-primary)', fontWeight: 450 }}
                  >
                    {habit.name}
                  </span>
                  {streak > 0 && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <Flame size={9} style={{ color: '#d97757' }} />
                      <span className="text-[9px] font-medium tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
                        {streak}
                      </span>
                    </div>
                  )}
                </div>

                {/* 7 天打卡格子（Loop Habit Tracker 核心视觉模式） */}
                <div className="flex items-center flex-shrink-0" style={{ gap: '4px' }}>
                  {days.map((d) => (
                    <CheckCircle
                      key={d.key}
                      checked={checkSet.has(d.key)}
                      color={color}
                      isToday={d.isToday}
                      onToggle={() => toggleCheckIn(habit.id, d.key)}
                    />
                  ))}
                </div>

                {/* 删除按钮（hover 时显示） */}
                <button
                  onClick={() => removeHabit(habit.id)}
                  className="flex-shrink-0 transition-opacity cursor-pointer"
                  style={{
                    opacity: 0,
                    color: 'var(--color-text-tertiary)',
                    background: 'none',
                    border: 'none',
                    padding: 2,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = 'var(--fig)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)';
                  }}
                  // group-hover via JS since Tailwind group requires parent context
                  ref={(el) => {
                    if (!el) return;
                    const row = el.closest('.group') as HTMLElement | null;
                    if (!row) return;
                    const show = () => { el.style.opacity = '1'; };
                    const hide = () => { el.style.opacity = '0'; };
                    row.addEventListener('mouseenter', show);
                    row.addEventListener('mouseleave', hide);
                  }}
                >
                  <Trash2 size={11} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── 空状态 ── */}
      {habits.length === 0 && !showAdd && (
        <div
          className="flex flex-col items-center justify-center"
          style={{ gap: '10px', paddingTop: '40px', paddingBottom: '40px' }}
        >
          <div style={{ fontSize: 28, lineHeight: 1 }}>🌱</div>
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {t('habits.empty')}
          </span>
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-md text-xs font-medium transition-all cursor-pointer"
            style={{
              marginTop: 4,
              padding: '6px 14px',
              backgroundColor: 'var(--color-fill)',
              color: 'var(--color-fill-text)',
              border: 'none',
            }}
          >
            {t('habits.addFirst')}
          </button>
        </div>
      )}
    </div>
  );
}
