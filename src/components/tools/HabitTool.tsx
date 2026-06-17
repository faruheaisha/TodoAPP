/**
 * HabitTool — 习惯打卡界面 v2 + 热力图视图
 *
 * 参考：
 *  Loop Habit Tracker (⭐9.9k): 每习惯提醒时间、30天完成率
 *  Habitica (⭐13.9k): 里程碑勋章体系、打卡奖励反馈
 *
 * v3 新增：
 *  - 打卡 / 热力图 视图切换
 *  - mulberry32 seeded PRNG（底层运算工具函数，保留备用）
 *  - buildHeatmapFromCheckins：真实打卡数据 → 18周 126格热力图
 *  - StatBox：当前连续 / 18周完成 / 完成率
 *  - 习惯选择器标签（彩色圆点 + 名称）
 *  - levelColor：0=灰底 4=习惯色
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

// ─── mulberry32 seeded PRNG（底层运算工具，保留备用）─────────────────────────
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── 18周热力图数据构建（真实打卡记录）─────────────────────────────────────
function buildHeatmapFromCheckins(checkIns: string[]): { date: string; level: number }[] {
  const ciSet = new Set(checkIns);
  const today = new Date();
  const result: { date: string; level: number }[] = [];
  for (let i = 125; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = toDateKey(d);
    result.push({ date: key, level: ciSet.has(key) ? 4 : 0 });
  }
  return result;
}

// ─── 热力图格子颜色 ──────────────────────────────────────────────────────────
function levelColor(level: number, habitColor: string): string {
  if (level === 0) return 'var(--color-bg-tertiary)';
  // level 1–4 逐渐加深；当前数据只有 0/4，直接返回习惯色
  const alphas = ['', '55', '88', 'bb', 'ff'];
  const a = alphas[Math.min(4, level)] ?? 'ff';
  return habitColor + a;
}

// ─── StatBox ─────────────────────────────────────────────────────────────────
function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      flex: 1, background: 'var(--color-bg-secondary)',
      border: '0.5px solid var(--color-border)',
      borderRadius: 12, padding: '10px 12px',
    }}>
      <div style={{ fontSize: '9px', color: 'var(--color-text-tertiary)', marginBottom: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
        {value}
      </div>
    </div>
  );
}

// ─── 热力图视图（横置大图 + 月份标注）──────────────────────────────────────────
interface HeatmapViewProps {
  habits: Habit[];
  lang: string;
}
function HeatmapView({ habits, lang }: HeatmapViewProps) {
  const [selectedId, setSelectedId] = useState<string>(habits[0]?.id ?? '');

  useEffect(() => {
    if (!habits.find(h => h.id === selectedId) && habits.length > 0) {
      setSelectedId(habits[0].id);
    }
  }, [habits, selectedId]);

  if (habits.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-tertiary)', fontSize: '12px' }}>
        {lang === 'zh' ? '还没有习惯，先去打卡视图添加吧～' : 'No habits yet. Add one in the Check-in view.'}
      </div>
    );
  }

  const habit = habits.find(h => h.id === selectedId) ?? habits[0];
  const habitColor = HABIT_COLORS[habit.color];
  const heatmapData = buildHeatmapFromCheckins(habit.checkIns);
  const completedCount = heatmapData.filter(d => d.level > 0).length;
  const completionRate = Math.round((completedCount / 126) * 100);
  const currentStreak = calcStreak(new Set(habit.checkIns));

  const WEEKS = 18;
  const CELL = 20;
  const GAP = 5;
  const DOW_W = 26;

  // 月份标签
  const monthLabels: { x: number; label: string }[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const cellIdx = w * 7;
    const d = new Date(heatmapData[cellIdx].date + 'T12:00:00');
    const m = lang === 'zh'
      ? `${d.getMonth() + 1}月`
      : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
    if (monthLabels.length === 0 || monthLabels[monthLabels.length - 1].label !== m) {
      monthLabels.push({ x: w * (CELL + GAP), label: m });
    }
  }

  // 星期标签（显示所有7行）
  const DOW_ZH = ['一', '二', '三', '四', '五', '六', '日'];
  const dowLabels = lang === 'zh'
    ? DOW_ZH
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 习惯选择器 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {habits.map(h => {
          const isActive = h.id === habit.id;
          const hc = HABIT_COLORS[h.color];
          return (
            <button
              key={h.id}
              onClick={() => setSelectedId(h.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: '11px', fontWeight: isActive ? 600 : 400,
                background: isActive ? hc + '22' : 'var(--color-bg-tertiary)',
                color: isActive ? hc : 'var(--color-text-secondary)',
                outline: isActive ? `1.5px solid ${hc}55` : 'none',
                transition: 'all 0.14s',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: hc, flexShrink: 0 }} />
              {h.name}
            </button>
          );
        })}
      </div>

      {/* StatBox 行 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <StatBox
          label={lang === 'zh' ? '当前连续' : 'Current Streak'}
          value={`${currentStreak}${lang === 'zh' ? ' 天' : 'd'}`}
        />
        <StatBox
          label={lang === 'zh' ? '18周完成' : '18-Week Total'}
          value={`${completedCount}${lang === 'zh' ? ' 次' : ''}`}
        />
        <StatBox
          label={lang === 'zh' ? '完成率' : 'Completion'}
          value={`${completionRate}%`}
        />
      </div>

      {/* 热力图主体 */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
      <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start', marginLeft: -14 }}>
        {/* 星期标签列 */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: `${GAP}px`,
          width: DOW_W, flexShrink: 0, marginTop: '22px',
        }}>
          {dowLabels.map((d, i) => (
            <div key={i} style={{
              height: CELL, display: 'flex', alignItems: 'center',
              justifyContent: 'flex-end',
              fontSize: '15px', color: 'var(--color-text-tertiary)',
              lineHeight: 1, paddingRight: 15,
            }}>
              {d}
            </div>
          ))}
        </div>

        {/* 网格 */}
        <div>
          {/* 月份标签行 */}
          <div style={{
            display: 'flex', gap: `${GAP}px`,
            height: '16px', marginBottom: '4px',
            marginLeft: `${GAP}px`,
            position: 'relative',
          }}>
            {monthLabels.map((ml, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: ml.x - 5,
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--color-text-tertiary)',
                whiteSpace: 'nowrap',
              }}>
                {ml.label}
              </div>
            ))}
          </div>

          {/* 18 × 7 格子 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${WEEKS}, ${CELL}px)`,
            gridTemplateRows: `repeat(7, ${CELL}px)`,
            gap: `${GAP}px`,
          }}>
            {heatmapData.map((cell, idx) => {
              const isToday = cell.date === heatmapData[heatmapData.length - 1].date;
              return (
                <div
                  key={idx}
                  title={`${cell.date}${cell.level > 0 ? (lang === 'zh' ? ' ✓ 已打卡' : ' ✓ Done') : ''}`}
                  style={{
                    width: CELL, height: CELL, borderRadius: 3,
                    backgroundColor: levelColor(cell.level, habitColor),
                    outline: isToday ? `1.5px solid ${habitColor}` : 'none',
                    outlineOffset: -1,
                    cursor: 'default',
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>

      {/* 图例 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '9px', color: 'var(--color-text-tertiary)' }}>
          {lang === 'zh' ? '少' : 'Less'}
        </span>
        {[0, 1, 2, 3, 4].map(lv => (
          <div key={lv} style={{
            width: 12, height: 12, borderRadius: 2,
            backgroundColor: levelColor(lv, habitColor),
          }} />
        ))}
        <span style={{ fontSize: '9px', color: 'var(--color-text-tertiary)' }}>
          {lang === 'zh' ? '多' : 'More'}
        </span>
      </div>
    </div>
  );
}

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
    <div title={`30天完成率 ${rate}%`} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <div style={{ width: '36px', height: '3px', borderRadius: '2px', background: 'var(--color-border)', overflow: 'hidden', flexShrink: 0 }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${rate}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: '2px', background: color }}
        />
      </div>
      <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{rate}%</span>
    </div>
  );
}

// ─── 弹性模式：本周进度药丸 ────────────────────────────────────────────────────
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

  // 视图：打卡 | 热力图
  const [habitView, setHabitView] = useState<'checkin' | 'heatmap'>('checkin');

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
    if (dateKey !== today) return; // 只允许打卡当天
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

      {/* ── 顶部：视图切换（左）+ 星期标签（右） ── */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* 视图切换 pill */}
        <div style={{
          display: 'flex', gap: 5, padding: 4,
          background: 'var(--color-bg-tertiary)',
          border: '0.5px solid var(--color-border)',
          borderRadius: 10, flexShrink: 0,
        }}>
          {(['checkin', 'heatmap'] as const).map(v => {
            const label = v === 'checkin'
              ? (lang === 'zh' ? '打卡' : 'Check-in')
              : (lang === 'zh' ? '热力图' : 'Heatmap');
            const isActive = habitView === v;
            return (
              <button
                key={v}
                onClick={() => setHabitView(v)}
                style={{
                  padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: isActive ? 600 : 400,
                  background: isActive ? 'var(--color-fill)' : 'transparent',
                  color: isActive ? 'var(--color-fill-text)' : 'var(--color-text-tertiary)',
                  transition: 'all 0.14s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* 右侧：星期标签（仅在打卡视图显示） */}
        {habitView === 'checkin' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            {days.map(d => (
              <div key={d.key} style={{
                width: '28px', textAlign: 'center', fontSize: '11px',
                color: d.isToday ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                fontWeight: d.isToday ? 600 : 400,
              }}>{d.label}</div>
            ))}
          </div>
        )}
      </div>

      {/* ── 热力图视图 ── */}
      {habitView === 'heatmap' && (
        <HeatmapView habits={habits} lang={lang} />
      )}

      {/* ── 打卡视图 ── */}
      {habitView === 'checkin' && (
        <>
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
                  {/* 第1行：颜色点 + 名称 + 打卡圆圈 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 0 0' }}>

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
                          flex: 1, fontSize: '14px', background: 'var(--color-bg-tertiary)',
                          border: '1px solid var(--color-border)', borderRadius: '4px',
                          padding: '2px 6px', color: 'var(--color-text-primary)', outline: 'none',
                        }}
                      />
                    ) : (
                      <span
                        onDoubleClick={() => { setEditingId(habit.id); setEditName(habit.name); }}
                        title={lang === 'zh' ? '双击编辑' : 'Double-click to edit'}
                        style={{ flex: 1, fontSize: '14px', color: 'var(--color-text-primary)', cursor: 'default', userSelect: 'none' }}
                      >
                        {habit.name}
                      </span>
                    )}

                    {/* 提醒图标 */}
                    {habit.reminderEnabled && habit.reminderTime && (
                      <span style={{ fontSize: '9px', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: '2px', marginRight: '4px' }}>
                        <Bell size={9} />
                        {habit.reminderTime}
                      </span>
                    )}

                    {/* 7天打卡格 */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {days.map(d => {
                        const checked = ciSet.has(d.key);
                        const isTodayCell = d.key === today;
                        return (
                          <motion.button
                            key={d.key}
                            onClick={() => handleToggle(habit, d.key)}
                            whileTap={{ scale: 0.85 }}
                            style={{
                              width: '28px', height: '28px', borderRadius: '50%', border: 'none',
                              cursor: d.key === today ? 'pointer' : 'default',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                  </div>

                  {/* 第2行（紧贴）：百分比横图 + 打卡天数 + 展开/删除 */}
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    gap: '6px', padding: '10px 0 5px', marginTop: '0', minHeight: '24px',
                    width: '100%',
                  }}>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* 完成率 */}
                    <CompletionBar rate={rate} color={color} />

                    {/* 每日：连续+勋章 | 弹性：本周进度药丸 */}
                    {isFlexible ? (
                      <WeeklyPill done={weeklyDone} target={habit.weeklyTarget} color={color} lang={lang} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', width: '56px', justifyContent: 'flex-end' }}>
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
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                style={{
                  padding: '12px', borderRadius: '10px', border: '0.5px solid var(--color-border)',
                  background: 'var(--color-bg-tertiary)', display: 'flex', flexDirection: 'column', gap: '10px',
                }}
              >
                {/* 习惯名称 */}
                <input
                  autoFocus
                  value={newName}
                  onChange={e => handleNameChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowAdd(false); }}
                  placeholder={t('habits.namePlaceholder')}
                  style={{
                    fontSize: '12px', background: 'var(--color-bg-secondary)',
                    border: '0.5px solid var(--color-border)', borderRadius: '6px',
                    padding: '6px 10px', color: 'var(--color-text-primary)', outline: 'none', width: '100%',
                  }}
                />

                {/* 智能时间建议 */}
                {timeSuggestion && newReminder === timeSuggestion && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
                    <Bell size={10} style={{ color: 'var(--color-accent)' }} />
                    <span style={{ color: 'var(--color-accent)' }}>
                      {lang === 'zh' ? `智能建议：${timeSuggestion}` : `Suggested: ${timeSuggestion}`}
                    </span>
                  </div>
                )}

                {/* 频率选择 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    {lang === 'zh' ? '频率' : 'Frequency'}
                  </span>
                  {(['daily', 'flexible'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setNewFrequency(f)}
                      style={{
                        fontSize: '10px', padding: '2px 9px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        background: newFrequency === f ? 'var(--color-fill)' : 'var(--color-bg-secondary)',
                        color: newFrequency === f ? 'var(--color-fill-text)' : 'var(--color-text-tertiary)',
                      }}
                    >
                      {f === 'daily' ? (lang === 'zh' ? '每天' : 'Daily') : (lang === 'zh' ? '弹性' : 'Flexible')}
                    </button>
                  ))}
                  {newFrequency === 'flexible' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        min={1} max={7}
                        value={newWeeklyTarget}
                        onChange={e => setNewWeeklyTarget(Math.min(7, Math.max(1, Number(e.target.value))))}
                        style={{
                          width: '36px', fontSize: '11px', textAlign: 'center',
                          background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)',
                          borderRadius: '4px', padding: '2px 4px', color: 'var(--color-text-primary)',
                        }}
                      />
                      <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
                        {lang === 'zh' ? '次/周' : 'x/week'}
                      </span>
                    </div>
                  )}
                </div>

                {/* 颜色 + 提醒 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* 颜色选择 */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {(Object.keys(HABIT_COLORS) as HabitColor[]).map(c => (
                      <button
                        key={c}
                        onClick={() => setNewColor(c)}
                        style={{
                          width: '18px', height: '18px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                          background: HABIT_COLORS[c],
                          outline: newColor === c ? `2px solid ${HABIT_COLORS[c]}` : 'none',
                          outlineOffset: '2px',
                        }}
                      />
                    ))}
                  </div>

                  {/* 提醒开关 + 时间 */}
                  <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newReminder !== ''}
                      onChange={e => setNewReminder(e.target.checked ? (timeSuggestion || '08:00') : '')}
                      style={{ accentColor: 'var(--color-accent)' }}
                    />
                    {lang === 'zh' ? '提醒' : 'Remind'}
                  </label>
                  {newReminder !== '' && (
                    <input
                      type="time"
                      value={newReminder}
                      onChange={e => setNewReminder(e.target.value)}
                      style={{
                        fontSize: '11px', background: 'var(--color-bg-secondary)',
                        border: '0.5px solid var(--color-border)', borderRadius: '4px',
                        padding: '2px 6px', color: 'var(--color-text-primary)', colorScheme: 'dark',
                      }}
                    />
                  )}
                </div>

                {/* 确认/取消 */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowAdd(false)}
                    style={{ fontSize: '11px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: '4px 10px' }}
                  >
                    {lang === 'zh' ? '取消' : 'Cancel'}
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={!newName.trim()}
                    style={{
                      fontSize: '11px', padding: '4px 14px', borderRadius: '6px', border: 'none',
                      cursor: newName.trim() ? 'pointer' : 'not-allowed',
                      background: newName.trim() ? 'var(--color-fill)' : 'var(--color-border)',
                      color: newName.trim() ? 'var(--color-fill-text)' : 'var(--color-text-tertiary)',
                    }}
                  >
                    {t('habits.confirm')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 底部新增按钮 */}
          {!showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 transition-colors cursor-pointer"
              style={{
                alignSelf: 'flex-start', fontSize: '11px', background: 'none', border: 'none', padding: '4px 0',
                color: 'var(--color-text-tertiary)', marginLeft: '-6px',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
            >
              <Plus size={13} />
              {t('habits.add')}
            </button>
          )}
        </>
      )}
    </div>
  );
}
