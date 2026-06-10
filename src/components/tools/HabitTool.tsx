/**
 * HabitTool — 习惯打卡界面 v2
 *
 * 参考：
 *  Loop Habit Tracker (⭐9.9k): 每习惯提醒时间、30天完成率
 *  Habitica (⭐13.9k): 里程碑勋章体系、打卡奖励反馈
 *
 * 新功能：
 *  - 智能时间建议：输入「睡前读书」自动建议 22:00 提醒
 *  - 每习惯提醒开关 + 时间设置
 *  - 里程碑勋章（7/21/30/100/365天）+ 首次达成庆祝 Toast
 *  - 30天完成率进度条
 *  - 习惯内联编辑（双击名称修改）
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Flame, Bell, BellOff, CheckCircle2, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import {
  useHabitStore, HABIT_COLORS, toDateKey, calcStreak, calcCompletionRate,
  calcWeeklyProgress, getCurrentMilestone, getNewMilestone, suggestReminderTime, MILESTONES,
  type HabitColor, type Habit,
} from '../../store/habitStore';

// ─── 最近7天日期格子 ───────────────────────────────────────────────────────────
function useDayGrid(lang: string) {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return {
      key:   toDateKey(d),
      label: d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short' }),
      isToday: i === 6,
    };
  });
}

// ─── Toast 组件 ───────────────────────────────────────────────────────────────
interface ToastItem { id: number; message: string; icon: string; }
function MilestoneToast({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg pointer-events-auto shadow-lg"
            style={{ background: 'var(--color-fill)', color: 'var(--color-fill-text)', fontSize: '12px', maxWidth: '220px' }}
          >
            <span style={{ fontSize: '18px' }}>{t.icon}</span>
            <span>{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── 完成率进度条 ──────────────────────────────────────────────────────────────
function CompletionBar({ rate, color }: { rate: number; color: string }) {
  return (
    <div title={`30天完成率 ${rate}%`} style={{ width: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
      <div style={{ fontSize: '8px', color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{rate}%</div>
      <div style={{ width: '100%', height: '3px', borderRadius: '2px', background: 'var(--color-border)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${rate}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: '2px', background: color }}
        />
      </div>
    </div>
  );
}

// ─── 弹性模式：本周进度药丸 ────────────────────────────────────────────────────
/**
 * 参考 Loop Habit Tracker Frequency 模式的视觉反馈：
 *  - 绿色（完成）：done >= target
 *  - 琥珀色（进行中）：0 < done < target
 *  - 默认灰色（未开始）：done === 0
 */
function WeeklyPill({ done, target, color, lang }: { done: number; target: number; color: string; lang: string }) {
  const isDone  = done >= target;
  const isPartial = done > 0 && !isDone;
  const pillColor = isDone ? color : isPartial ? '#f59e0b' : 'var(--color-text-tertiary)';
  const bgAlpha  = isDone ? '22' : isPartial ? '18' : '0d';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', minWidth: '48px' }}>
      <div
        title={lang === 'zh' ? `本周已完成 ${done}/${target} 次` : `This week: ${done}/${target}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '3px',
          padding: '2px 7px', borderRadius: '20px', fontSize: '10px', fontWeight: 600,
          color: pillColor,
          backgroundColor: pillColor + bgAlpha,
          border: `0.5px solid ${pillColor}44`,
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
          transition: 'all 0.2s',
        }}
      >
        {isDone && <span style={{ fontSize: '9px' }}>✓</span>}
        {done}/{target}
        <span style={{ fontWeight: 400, opacity: 0.8 }}>{lang === 'zh' ? '周' : 'wk'}</span>
      </div>
      {/* 进度条 */}
      <div style={{ width: '100%', height: '2px', borderRadius: '1px', background: 'var(--color-border)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, (done / target) * 100)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: '1px', background: pillColor }}
        />
      </div>
    </div>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────
export function HabitTool() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const days = useDayGrid(lang);
  const today = toDateKey(new Date());

  const { habits, addHabit, removeHabit, updateHabit, toggleCheckIn, markMilestoneShown } = useHabitStore();

  // 新增表单状态
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<HabitColor>('clay');
  const [newReminder, setNewReminder] = useState('');
  const [newNote, setNewNote] = useState('');
  const [timeSuggestion, setTimeSuggestion] = useState<string | null>(null);
  const [newFrequency, setNewFrequency] = useState<'daily' | 'flexible'>('daily');
  const [newWeeklyTarget, setNewWeeklyTarget] = useState(3);

  // 编辑状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 删除 hover 状态
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // 里程碑 Toast
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);

  const addToast = useCallback((icon: string, message: string) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, icon, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ── 智能时间建议 ─────────────────────────────────────────────────────────────
  const handleNameChange = (v: string) => {
    setNewName(v);
    const s = suggestReminderTime(v);
    setTimeSuggestion(s);
    if (s && !newReminder) setNewReminder(s);
  };

  // ── 分钟级提醒检查（Loop 参考）──────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const timeStr = `${hh}:${mm}`;
      const todayKey = toDateKey(now);
      for (const habit of habits) {
        if (habit.reminderEnabled && habit.reminderTime === timeStr && !habit.checkIns.includes(todayKey)) {
          try {
            const { sendNotification } = await import('@tauri-apps/plugin-notification');
            await sendNotification({
              title: lang === 'zh' ? '习惯提醒' : 'Habit Reminder',
              body: habit.name,
            });
          } catch { /* 桌面通知不可用时静默 */ }
        }
      }
    };
    check();
    const timer = setInterval(check, 60000);
    return () => clearInterval(timer);
  }, [habits, lang]);

  // ── 打卡 + 里程碑检测 ────────────────────────────────────────────────────────
  const handleToggle = (habit: Habit, dateKey: string) => {
    toggleCheckIn(habit.id, dateKey);
    // 打卡后检测新里程碑（仅今日打卡触发）
    if (dateKey === today && !habit.checkIns.includes(dateKey)) {
      const newCheckIns = new Set([...habit.checkIns, dateKey]);
      const streak = calcStreak(newCheckIns);
      const ms = getNewMilestone(streak, habit.milestonesShown);
      if (ms) {
        markMilestoneShown(habit.id, ms.days);
        const msg = lang === 'zh'
          ? `🎉 ${habit.name} 达成 ${ms.label}！`
          : `🎉 ${habit.name}: ${ms.labelEn}!`;
        addToast(ms.icon, msg);
      }
    }
  };

  // ── 新增确认 ─────────────────────────────────────────────────────────────────
  const handleAdd = () => {
    if (!newName.trim()) return;
    addHabit(newName.trim(), newColor, newReminder, newNote, newFrequency, newWeeklyTarget);
    setNewName(''); setNewColor('clay'); setNewReminder('');
    setNewNote(''); setTimeSuggestion(null);
    setNewFrequency('daily'); setNewWeeklyTarget(3);
    setShowAdd(false);
  };

  // ── 编辑保存 ─────────────────────────────────────────────────────────────────
  const handleEditSave = (id: string) => {
    if (editName.trim()) updateHabit(id, { name: editName.trim() });
    setEditingId(null);
  };

  const isEmpty = habits.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '200px' }}>
      <MilestoneToast toasts={toasts} onRemove={(id) => setToasts(p => p.filter(t => t.id !== id))} />

      {/* 顶部：标题 + 最近7天列头 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', flex: 1 }}>
          {t('habits.subtitle')}
        </span>
        <div style={{ display: 'flex', gap: '4px', marginRight: '64px' }}>
          {days.map(d => (
            <div key={d.key} style={{
              width: '26px', textAlign: 'center', fontSize: '9px',
              color: d.isToday ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
              fontWeight: d.isToday ? 600 : 400,
            }}>{d.label}</div>
          ))}
        </div>
      </div>

      {/* 习惯列表 */}
      <AnimatePresence initial={false}>
        {isEmpty && !showAdd && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-tertiary)', fontSize: '12px' }}
          >
            {t('habits.empty')}
          </motion.div>
        )}

        {habits.map(habit => {
          const ciSet = new Set(habit.checkIns);
          const streak = calcStreak(ciSet);
          const rate   = calcCompletionRate(habit.checkIns);
          const ms     = getCurrentMilestone(streak);
          const color  = HABIT_COLORS[habit.color];
          const isExpanded = expandedId === habit.id;

          const isFlexible = habit.frequency === 'flexible';
          const weeklyDone = isFlexible ? calcWeeklyProgress(habit.checkIns) : 0;

          return (
            <motion.div
              key={habit.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              onMouseEnter={() => setHoveredId(habit.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* 主行 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0' }}>

                {/* 颜色点 */}
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />

                {/* 名称（双击编辑）*/}
                {editingId === habit.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => handleEditSave(habit.id)}
                    onKeyDown={e => { if (e.key === 'Enter') handleEditSave(habit.id); if (e.key === 'Escape') setEditingId(null); }}
                    style={{
                      flex: 1, fontSize: '12px', background: 'var(--color-bg-tertiary)',
                      border: '1px solid var(--color-border)', borderRadius: '4px',
                      padding: '2px 6px', color: 'var(--color-text-primary)', outline: 'none',
                    }}
                  />
                ) : (
                  <span
                    onDoubleClick={() => { setEditingId(habit.id); setEditName(habit.name); }}
                    title={lang === 'zh' ? '双击编辑' : 'Double-click to edit'}
                    style={{ flex: 1, fontSize: '12px', color: 'var(--color-text-primary)', cursor: 'default', userSelect: 'none' }}
                  >
                    {habit.name}
                  </span>
                )}

                {/* 提醒图标 */}
                {habit.reminderEnabled && habit.reminderTime && (
                  <span style={{ fontSize: '9px', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <Bell size={9} />
                    {habit.reminderTime}
                  </span>
                )}

                {/* 7天打卡格 */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  {days.map(d => {
                    const checked = ciSet.has(d.key);
                    const isTodayCell = d.key === today;
                    return (
                      <motion.button
                        key={d.key}
                        onClick={() => handleToggle(habit, d.key)}
                        whileTap={{ scale: 0.85 }}
                        style={{
                          width: '26px', height: '26px', borderRadius: '50%', border: 'none',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: checked ? color : 'var(--color-bg-tertiary)',
                          outline: isTodayCell && !checked ? `1.5px solid ${color}` : 'none',
                          outlineOffset: '-1px',
                          transition: 'background 0.15s',
                        }}
                      >
                        <AnimatePresence mode="wait">
                          {checked && (
                            <motion.svg
                              key="check"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', damping: 15, stiffness: 400 }}
                              width="12" height="12" viewBox="0 0 12 12" fill="none"
                            >
                              <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </motion.svg>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    );
                  })}
                </div>

                {/* 完成率 */}
                <CompletionBar rate={rate} color={color} />

                {/* 每日：连续+勋章 | 弹性：本周进度药丸 */}
                {isFlexible ? (
                  <WeeklyPill done={weeklyDone} target={habit.weeklyTarget} color={color} lang={lang} />
                ) : (
                  <div style={{ width: '56px', display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end' }}>
                    {streak > 0 && <Flame size={11} style={{ color: '#f59e0b', flexShrink: 0 }} />}
                    <span style={{ fontSize: '11px', color: streak > 0 ? '#f59e0b' : 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                      {streak > 0 ? `${streak}${lang === 'zh' ? '天' : 'd'}` : '—'}
                    </span>
                    {ms && <span title={lang === 'zh' ? ms.label : ms.labelEn} style={{ fontSize: '13px', cursor: 'default' }}>{ms.icon}</span>}
                  </div>
                )}

                {/* 展开/删除 */}
                <div style={{ display: 'flex', gap: '2px', opacity: hoveredId === habit.id ? 1 : 0, transition: 'opacity 0.15s' }}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : habit.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: '2px', borderRadius: '4px', display: 'flex' }}
                  >
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  <button
                    onClick={() => removeHabit(habit.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: '2px', borderRadius: '4px', display: 'flex' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              {/* 展开详情（提醒设置 + 里程碑进度）*/}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{
                      margin: '4px 0 6px 16px', padding: '10px 12px', borderRadius: '8px',
                      background: 'var(--color-bg-tertiary)', border: '0.5px solid var(--color-border)',
                      display: 'flex', flexDirection: 'column', gap: '8px',
                    }}>
                      {/* 频率设置 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                          {lang === 'zh' ? '模式' : 'Mode'}
                        </span>
                        <div className="flex overflow-hidden rounded border flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                          {(['daily', 'flexible'] as const).map(f => (
                            <button
                              key={f}
                              onClick={() => updateHabit(habit.id, { frequency: f })}
                              style={{
                                padding: '2px 10px', fontSize: '10px', border: 'none', cursor: 'pointer',
                                fontWeight: habit.frequency === f ? 500 : 400,
                                background: habit.frequency === f ? color : 'transparent',
                                color: habit.frequency === f ? '#fff' : 'var(--color-text-tertiary)',
                                transition: 'all 0.15s',
                              }}
                            >
                              {f === 'daily' ? (lang === 'zh' ? '每日' : 'Daily') : (lang === 'zh' ? '弹性' : 'Flexible')}
                            </button>
                          ))}
                        </div>
                        {habit.frequency === 'flexible' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                            {lang === 'zh' ? '每周' : 'Per week'}
                            <input
                              type="number" min={1} max={6}
                              value={habit.weeklyTarget}
                              onChange={e => updateHabit(habit.id, { weeklyTarget: Math.max(1, Math.min(6, Number(e.target.value))) })}
                              style={{
                                width: '36px', fontSize: '11px', textAlign: 'center',
                                background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)',
                                borderRadius: '4px', padding: '2px 4px', color: 'var(--color-text-primary)', outline: 'none',
                              }}
                            />
                            {lang === 'zh' ? '次' : 'times'}
                          </div>
                        )}
                      </div>

                      {/* 提醒设置 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={habit.reminderEnabled}
                            onChange={e => updateHabit(habit.id, { reminderEnabled: e.target.checked })}
                            style={{ accentColor: color }}
                          />
                          {lang === 'zh' ? '每日提醒' : 'Daily reminder'}
                        </label>
                        {habit.reminderEnabled && (
                          <input
                            type="time"
                            value={habit.reminderTime}
                            onChange={e => updateHabit(habit.id, { reminderTime: e.target.value })}
                            style={{
                              fontSize: '11px', background: 'var(--color-bg-secondary)',
                              border: '0.5px solid var(--color-border)', borderRadius: '4px',
                              padding: '2px 6px', color: 'var(--color-text-primary)',
                              colorScheme: 'dark',
                            }}
                          />
                        )}
                      </div>

                      {/* 里程碑进度 */}
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginBottom: '5px' }}>
                          {lang === 'zh' ? '里程碑进度' : 'Milestones'}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {MILESTONES.map(m => {
                            const reached = streak >= m.days;
                            return (
                              <div
                                key={m.days}
                                title={`${lang === 'zh' ? m.label : m.labelEn} (${m.days}${lang === 'zh' ? '天' : 'd'})`}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '3px',
                                  padding: '2px 6px', borderRadius: '10px', fontSize: '10px',
                                  background: reached ? color + '22' : 'var(--color-bg-secondary)',
                                  border: `0.5px solid ${reached ? color + '44' : 'var(--color-border)'}`,
                                  color: reached ? color : 'var(--color-text-tertiary)',
                                  opacity: reached ? 1 : 0.6,
                                }}
                              >
                                <span>{m.icon}</span>
                                <span>{m.days}{lang === 'zh' ? '天' : 'd'}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* 新增表单 */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initia