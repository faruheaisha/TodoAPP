/**
 * InsightsTool — 数据洞察面板
 *
 * 设计理念：
 *  - 纯 SVG 图表，零外部依赖，bundle 不增大
 *  - 数据全部来自已有 store，无新网络请求
 *
 * 参考开源项目：
 *  - GitHub Contribution Graph (全球最知名热力图 UX pattern)
 *  - Obsidian Stats Plugin (⭐4.2k, Trikzon/obsidian-graphs): 紧凑嵌入式数据可视化
 *  - Habitify: 每日习惯完成率柱状图样式
 */
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flame, Clock, CheckCircle2, Target } from 'lucide-react';
import { useFocusStore } from '../../store/focusStore';
import { useHabitStore, toDateKey, calcStreak, HABIT_COLORS } from '../../store/habitStore';
import { useTodoStore } from '../../store/todoStore';

// ─── 工具函数 ─────────────────────────────────────────────────────────────────
function dateKey(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toDateKey(d);
}

function shortWeekday(dateStr: string, locale: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(locale, { weekday: 'short' });
}

// ─── 7日专注柱状图 ─────────────────────────────────────────────────────────────
function FocusBarChart({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const { sessionLog, settings } = useFocusStore();
  const locale = lang === 'zh' ? 'zh-CN' : 'en-US';

  // 按日聚合最近7天
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const key = dateKey(i - 6);
      const mins = sessionLog
        .filter(e => e.date === key)
        .reduce((acc, e) => acc + e.minutes, 0);
      return { key, mins };
    });
  }, [sessionLog]);

  const maxMins = Math.max(...days.map(d => d.mins), 1);
  const totalMins = days.reduce((a, d) => a + d.mins, 0);
  const totalH = (totalMins / 60).toFixed(1);

  const BAR_H = 60;
  const BAR_W = 18;
  const GAP   = 10;
  const SVG_W = 7 * (BAR_W + GAP) - GAP;

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* 区块标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={12} style={{ color: 'var(--color-accent)' }} />
          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {t('insights.focusTitle')}
          </span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
          {lang === 'zh' ? `本周 ${totalH}h` : `This week ${totalH}h`}
        </span>
      </div>

      {/* SVG 柱状图 */}
      <svg width={SVG_W} height={BAR_H + 18} style={{ display: 'block', overflow: 'visible' }}>
        {days.map((d, i) => {
          const x = i * (BAR_W + GAP);
          const barH = d.mins > 0 ? Math.max(4, (d.mins / maxMins) * BAR_H) : 2;
          const y = BAR_H - barH;
          const isToday = i === 6;
          return (
            <g key={d.key}>
              {/* 空心底座（灰色背景） */}
              <rect
                x={x} y={0} width={BAR_W} height={BAR_H}
                rx={4}
                fill="var(--color-bg-tertiary)"
              />
              {/* 实心进度条 */}
              {d.mins > 0 && (
                <rect
                  x={x} y={y} width={BAR_W} height={barH}
                  rx={4}
                  fill={isToday ? 'var(--color-accent)' : 'var(--color-accent)'}
                  opacity={isToday ? 1 : 0.55}
                />
              )}
              {/* 分钟标签（有数据时显示） */}
              {d.mins > 0 && (
                <text
                  x={x + BAR_W / 2} y={y - 3}
                  textAnchor="middle"
                  fontSize="8"
                  fill="var(--color-text-tertiary)"
                >
                  {d.mins >= 60 ? `${(d.mins/60).toFixed(1)}h` : `${d.mins}m`}
                </text>
              )}
              {/* 星期标签 */}
              <text
                x={x + BAR_W / 2} y={BAR_H + 14}
                textAnchor="middle"
                fontSize="8"
                fill={isToday ? 'var(--color-accent)' : 'var(--color-text-tertiary)'}
                fontWeight={isToday ? 600 : 400}
              >
                {shortWeekday(d.key, locale)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* 无数据提示 */}
      {totalMins === 0 && (
        <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
          {lang === 'zh' ? '本周还没有专注记录，开始第一个番茄钟吧 🍅' : 'No focus sessions yet. Start your first Pomodoro! 🍅'}
        </p>
      )}
    </div>
  );
}

// ─── 习惯热力图（GitHub contribution graph 风格）──────────────────────────────
function HabitHeatmap({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const { habits } = useHabitStore();

  // 最近 5 周 × 7 天 = 35 格
  const WEEKS = 5;
  const CELL  = 11;
  const GAP   = 3;

  const grid = useMemo(() => {
    return Array.from({ length: WEEKS * 7 }, (_, i) => {
      const key = dateKey(i - (WEEKS * 7 - 1));
      const count = habits.filter(h => h.checkIns.includes(key)).length;
      return { key, count };
    });
  }, [habits]);

  const maxCount = Math.max(...grid.map(g => g.count), 1);

  // 最长连续天数（所有习惯中最高）
  const topStreak = useMemo(() => {
    if (!habits.length) return 0;
    return Math.max(...habits.map(h => calcStreak(new Set(h.checkIns))));
  }, [habits]);

  if (!habits.length) {
    return (
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <Flame size={12} style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {t('insights.habitTitle')}
          </span>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
          {lang === 'zh' ? '还没有习惯，去习惯打卡添加第一个吧' : 'No habits yet. Add one in the Habits tab!'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Flame size={12} style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {t('insights.habitTitle')}
          </span>
        </div>
        {topStreak > 0 && (
          <span style={{ fontSize: '11px', color: '#f59e0b' }}>
            🔥 {lang === 'zh' ? `最长 ${topStreak} 天` : `Best ${topStreak}d streak`}
          </span>
        )}
      </div>

      {/* 热力格 */}
      <svg
        width={WEEKS * (CELL + GAP) - GAP}
        height={7 * (CELL + GAP) - GAP}
        style={{ display: 'block' }}
      >
        {grid.map((cell, idx) => {
          const col = Math.floor(idx / 7);
          const row = idx % 7;
          const x = col * (CELL + GAP);
          const y = row * (CELL + GAP);
          const opacity = cell.count === 0 ? 0 : 0.15 + 0.85 * (cell.count / maxCount);
          const isToday = cell.key === dateKey(0);
          return (
            <rect
              key={cell.key}
              x={x} y={y}
              width={CELL} height={CELL}
              rx={2}
              fill={cell.count > 0 ? 'var(--color-accent)' : 'var(--color-bg-tertiary)'}
              opacity={cell.count > 0 ? opacity : 1}
              stroke={isToday ? 'var(--color-accent)' : 'none'}
              strokeWidth={isToday ? 1.5 : 0}
            >
              <title>{`${cell.key}: ${cell.count} habit${cell.count !== 1 ? 's' : ''}`}</title>
            </rect>
          );
        })}
      </svg>

      {/* 图例 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
        <span style={{ fontSize: '9px', color: 'var(--color-text-tertiary)' }}>
          {lang === 'zh' ? '少' : 'Less'}
        </span>
        {[0, 0.25, 0.5, 0.75, 1].map((o, i) => (
          <svg key={i} width={CELL} height={CELL} style={{ display: 'inline-block' }}>
            <rect x={0} y={0} width={CELL} height={CELL} rx={2}
              fill={o === 0 ? 'var(--color-bg-tertiary)' : 'var(--color-accent)'}
              opacity={o === 0 ? 1 : 0.15 + 0.85 * o}
            />
          </svg>
        ))}
        <span style={{ fontSize: '9px', color: 'var(--color-text-tertiary)' }}>
          {lang === 'zh' ? '多' : 'More'}
        </span>
      </div>
    </div>
  );
}

// ─── 数据速览 ──────────────────────────────────────────────────────────────────
function QuickStats({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const { completedWorkSessions, settings } = useFocusStore();
  const { habits } = useHabitStore();
  const { todos } = useTodoStore();

  const completedTodos = todos.filter(t => t.completed).length;
  const totalTodos     = todos.length;
  const totalHabits    = habits.length;
  const activeHabits   = useMemo(() => {
    const todayKey = dateKey(0);
    return habits.filter(h => h.checkIns.includes(todayKey)).length;
  }, [habits]);

  const totalFocusH = ((completedWorkSessions * settings.workMinutes) / 60).toFixed(1);

  const stats = [
    {
      icon: <Clock size={13} style={{ color: 'var(--color-accent)' }} />,
      value: `${totalFocusH}h`,
      label: lang === 'zh' ? '累计专注' : 'Total Focus',
    },
    {
      icon: <Flame size={13} style={{ color: '#f59e0b' }} />,
      value: `${activeHabits}/${totalHabits}`,
      label: lang === 'zh' ? '今日习惯' : "Today's Habits",
    },
    {
      icon: <CheckCircle2 size={13} style={{ color: '#6a9bcc' }} />,
      value: `${completedTodos}/${totalTodos}`,
      label: lang === 'zh' ? 'Todo 完成' : 'Todos Done',
    },
    {
      icon: <Target size={13} style={{ color: '#788c5d' }} />,
      value: `${completedWorkSessions}`,
      label: lang === 'zh' ? '完成番茄' : 'Pomodoros',
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
        <Target size={12} style={{ color: 'var(--color-text-secondary)' }} />
        <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
          {t('insights.statsTitle')}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {stats.map((s, i) => (
          <div
            key={i}
            style={{
              padding: '10px 8px',
              borderRadius: '8px',
              background: 'var(--color-bg-tertiary)',
              border: '0.5px solid var(--color-border)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              textAlign: 'center',
            }}
          >
            {s.icon}
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {s.value}
            </span>
            <span style={{ fontSize: '9px', color: 'var(--color-text-tertiary)', lineHeight: 1.2 }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────
export function InsightsTool() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {/* 分隔线样式的区块 */}
      <FocusBarChart lang={lang} />
      <div style={{ height: '0.5px', background: 'var(--color-border)', margin: '4px 0' }} />
      <HabitHeatmap lang={lang} />
      <div style={{ height: '0.5px', background: 'var(--color-border)', margin: '4px 0' }} />
      <QuickStats lang={lang} />
    </div>
  );
}
