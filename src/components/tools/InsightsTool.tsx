/**
 * InsightsTool — 数据洞察面板 v3
 *
 * 改进：
 *  - TopStatRow：本周完成 / 专注时长 / 较上周
 *  - FocusBarChart：growBar CSS 动画（柱子从底部生长）
 *  - CompletionTrendChart: Y 轴网格线/标签 + X 轴日期标签
 *  - HabitHeatmap: 修复图例被截断问题
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flame, Clock, CheckCircle2, Target, TrendingUp } from 'lucide-react';
import { useFocusStore } from '../../store/focusStore';
import { useHabitStore, toDateKey, calcStreak } from '../../store/habitStore';
import { useTodoStore } from '../../store/todoStore';
import { useCompletionStore } from '../../store/completionStore';

// ─── growBar CSS 关键帧（柱状图从底部生长）──────────────────────────────────
const GROW_BAR_STYLE = `
@keyframes growBar {
  from { height: 0; y: auto; }
}
.asha-grow-bar {
  animation: growBar 0.45s cubic-bezier(0.34,1.56,0.64,1) both;
}
`;

function dateKey(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toDateKey(d);
}

// ─── TopStatRow：本周完成 / 专注时长 / 较上周 ────────────────────────────────
function TopStatRow({ lang }: { lang: string }) {
  const completionTimes = useCompletionStore((s) => s.completionTimes);
  const { sessionLog, settings } = useFocusStore();

  // 本周起点（本周一）
  const thisWeekStart = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    const start = new Date(d);
    start.setDate(d.getDate() + diff);
    return toDateKey(start);
  }, []);

  // 上周起/止
  const lastWeekRange = useMemo(() => {
    const d = new Date(thisWeekStart + 'T00:00:00');
    const end = new Date(d);
    end.setDate(d.getDate() - 1);
    const start = new Date(d);
    start.setDate(d.getDate() - 7);
    return { start: toDateKey(start), end: toDateKey(end) };
  }, [thisWeekStart]);

  // 本周完成任务数
  const thisWeekDone = useMemo(() => {
    return Object.values(completionTimes).filter(iso => toDateKey(new Date(iso)) >= thisWeekStart).length;
  }, [completionTimes, thisWeekStart]);

  // 上周完成任务数
  const lastWeekDone = useMemo(() => {
    return Object.values(completionTimes).filter(iso => {
      const d = toDateKey(new Date(iso));
      return d >= lastWeekRange.start && d <= lastWeekRange.end;
    }).length;
  }, [completionTimes, lastWeekRange]);

  // 本周专注分钟
  const thisWeekFocusMins = useMemo(() => {
    return sessionLog
      .filter(e => e.date >= thisWeekStart)
      .reduce((acc, e) => acc + e.minutes, 0);
  }, [sessionLog, thisWeekStart]);

  // 与上周对比（+/- %）
  const weekDelta = useMemo(() => {
    if (lastWeekDone === 0) return null;
    const pct = Math.round(((thisWeekDone - lastWeekDone) / lastWeekDone) * 100);
    return pct;
  }, [thisWeekDone, lastWeekDone]);

  const focusH = (thisWeekFocusMins / 60).toFixed(1);
  const deltaLabel = weekDelta === null
    ? (lang === 'zh' ? '—' : '—')
    : weekDelta >= 0
      ? `+${weekDelta}%`
      : `${weekDelta}%`;
  const deltaColor = weekDelta === null ? 'var(--color-text-tertiary)'
    : weekDelta >= 0 ? '#788c5d' : '#c46686';

  const boxes = [
    { label: lang === 'zh' ? '本周完成任务' : 'Tasks Done This Week', value: `${thisWeekDone}`, unit: lang === 'zh' ? '项' : '' },
    { label: lang === 'zh' ? '本周专注时长' : 'Focus Time This Week', value: `${focusH}h`, unit: '' },
    { label: lang === 'zh' ? '较上周变化' : 'vs Last Week', value: deltaLabel, color: deltaColor, unit: '' },
  ];

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 0 }}>
      {boxes.map((b, i) => (
        <div key={i} style={{
          flex: 1,
          background: 'var(--color-bg-secondary)',
          border: '0.5px solid var(--color-border)',
          borderRadius: 12,
          padding: '14px',
        }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, letterSpacing: '0.02em' }}>
            {b.label}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontSize: '22px', fontWeight: 700, color: b.color ?? 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
              {b.value}
            </span>
            {b.unit && <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', fontWeight: 500 }}>{b.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function shortWeekday(dateStr: string, locale: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(locale, { weekday: 'short' });
}

// ─── 14日完成趋势折线图（精简紧凑版，每日标注 + 悬停提示）─────────────────────
function CompletionTrendChart({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const completionTimes = useCompletionStore((s) => s.completionTimes);
  const [hovered, setHovered] = useState<{ key: string; count: number; x: number; y: number } | null>(null);

  const DAYS = 14;
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const iso of Object.values(completionTimes)) {
      const key = toDateKey(new Date(iso));
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Array.from({ length: DAYS }, (_, i) => {
      const key = dateKey(i - (DAYS - 1));
      return { key, count: counts[key] ?? 0 };
    });
  }, [completionTimes]);

  const max = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((a, d) => a + d.count, 0);

  // 所有整数刻度（0 到 max）
  const yTicks = Array.from({ length: max + 1 }, (_, i) => i);

  // 紧凑尺寸
  const W = 320, H = 96;
  const padLeft = 20, padRight = 4, padTop = 8, padBottom = 18;
  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBottom;
  const chartBottom = padTop + innerH;

  const pts = data.map((d, i) => {
    const x = padLeft + (innerW * i) / (DAYS - 1);
    const y = padTop + innerH * (1 - d.count / max);
    return { x, y, ...d };
  });
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${chartBottom} L${pts[0].x.toFixed(1)},${chartBottom} Z`;

  const fmtDate = (key: string) => {
    const d = new Date(key + "T12:00:00");
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const handleMouseEnter = (p: (typeof pts)[0]) => {
    setHovered({ key: p.key, count: p.count, x: p.x, y: p.y });
  };
  const handleMouseLeave = () => setHovered(null);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <TrendingUp size={16} style={{ color: "var(--color-accent)" }} />
          <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>
            {t("insights.trendTitle")}
          </span>
        </div>
        <span style={{ fontSize: "11px", color: "var(--color-text-tertiary)" }}>
          {lang === "zh" ? `共 ${total} 项` : `${total} done`}
        </span>
      </div>

      {total === 0 ? (
        <p style={{ fontSize: "12px", color: "var(--color-text-tertiary)" }}>
          {lang === "zh" ? "近两周还没有完成记录" : "No completions in the last 14 days yet."}
        </p>
      ) : (
        <div style={{ position: "relative", width: '100%' }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Y 轴网格线 + 标签（每个整数刻度） */}
            {yTicks.map((tick) => {
              const gy = padTop + innerH * (1 - tick / max);
              return (
                <g key={tick}>
                  <line
                    x1={padLeft} y1={gy} x2={padLeft + innerW} y2={gy}
                    stroke="var(--color-border)" strokeWidth={tick === 0 ? 0.5 : 0.3}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={padLeft - 3} y={gy + 3}
                    textAnchor="end" fontSize="8"
                    fill="var(--color-text-tertiary)"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* 面积填充 + 折线 */}
            <path d={area} fill="url(#trendFill)" />
            <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth="1.8"
              strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

            {/* 数据点 + X 轴日期标签 */}
            {pts.map((p, i) => (
              <g key={p.key}>
                {/* 不可见热区（方便 hover） */}
                <rect
                  x={p.x - 6} y={padTop - 4} width={12} height={innerH + 8}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => handleMouseEnter(p)}
                  onMouseLeave={handleMouseLeave}
                />
                {/* 数据点圆圈 */}
                <circle
                  cx={p.x} cy={p.y}
                  r={p.count > 0 ? 3 : 0}
                  fill={p.count > 0 ? "var(--color-bg-secondary)" : "none"}
                  stroke="var(--color-accent)"
                  strokeWidth={p.count > 0 ? 1.5 : 0}
                  vectorEffect="non-scaling-stroke"
                />
                {/* X 轴日期标签 */}
                <text
                  x={p.x} y={chartBottom + 12}
                  textAnchor="middle" fontSize="8"
                  fill={i === DAYS - 1 ? "var(--color-accent)" : "var(--color-text-tertiary)"}
                  fontWeight={i === DAYS - 1 ? 600 : 400}
                >
                  {fmtDate(p.key)}
                </text>
              </g>
            ))}
          </svg>

          {/* 悬停 tooltip */}
          {hovered && (
            <div
              style={{
                position: "absolute",
                left: `${(hovered.x / W) * 100}%`,
                top: `${(hovered.y / H) * 100}%`,
                transform: "translate(-50%, -110%)",
                background: "var(--color-bg-secondary)",
                border: "0.5px solid var(--color-border)",
                borderRadius: 6,
                padding: "4px 8px",
                fontSize: "11px",
                fontWeight: 500,
                color: "var(--color-text-primary)",
                pointerEvents: "none",
                whiteSpace: "nowrap",
                boxShadow: "0 2px 6px rgba(0,0,0,.08)",
                zIndex: 10,
              }}
            >
              {fmtDate(hovered.key)} · {hovered.count} {lang === "zh" ? "项" : "done"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 7日专注柱状图（带纵坐标，上限4h，实时数据）────────────────────────────
function FocusBarChart({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const { sessionLog, settings, dailyFocusMinutes, isRunning } = useFocusStore();
  const locale = lang === "zh" ? "zh-CN" : "en-US";

  // 使用 dailyFocusMinutes 作为主要数据源（实时累计），
  // 与 sessionLog 合并得到全天专注分钟数
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const key = dateKey(i - 6);
      // 从 dailyFocusMinutes 取实时累计值
      const realtimeMins = dailyFocusMinutes[key] ?? 0;
      // 从 sessionLog 取已完成 session 分钟数
      const logMins = sessionLog
        .filter(e => e.date === key)
        .reduce((acc, e) => acc + e.minutes, 0);
      // 两者取较大值（实时累计覆盖未完成 session，已完成 session 补充）
      return { key, mins: Math.max(realtimeMins, logMins) };
    });
  }, [sessionLog, dailyFocusMinutes]);

  const maxMins = Math.max(...days.map(d => d.mins), 1);
  const totalMins = days.reduce((a, d) => a + d.mins, 0);
  const totalH = (totalMins / 60).toFixed(1);

  // Y 轴上限：240min（4h），取整
  const Y_MAX = Math.max(240, Math.ceil(maxMins / 60) * 60);
  // Y 轴刻度：每 60min 一格
  const yTicks: number[] = [];
  for (let t = 0; t <= Y_MAX; t += 60) {
    yTicks.push(t);
  }

  const BAR_H = 160;
  const BAR_W = 40;
  const GAP   = 18;
  const SVG_W = 7 * (BAR_W + GAP) - GAP;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Clock size={16} style={{ color: "var(--color-accent)" }} />
          <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>
            {t("insights.focusTitle")}
          </span>
        </div>
        <span style={{ fontSize: "11px", color: "var(--color-text-tertiary)" }}>
          {lang === "zh" ? `本周 ${totalH}h` : `This week ${totalH}h`}
        </span>
      </div>

      {totalMins === 0 ? (
        <p style={{ fontSize: "11px", color: "var(--color-text-tertiary)", marginTop: "4px" }}>
          {lang === "zh" ? "本周还没有专注记录，开始第一个番茄钟吧" : "No focus sessions yet. Start your first Pomodoro!"}
        </p>
      ) : (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <svg width={SVG_W + 32} height={BAR_H + 28} style={{ display: "block", overflow: "visible" }}>
            {/* Y 轴网格线 + 标签 */}
            {yTicks.map((tick) => {
              const gy = BAR_H * (1 - tick / Y_MAX);
              return (
                <g key={tick}>
                  <line
                    x1={32} y1={gy} x2={32 + SVG_W} y2={gy}
                    stroke="var(--color-border)" strokeWidth={tick === 0 ? 0.5 : 0.3}
                  />
                  <text
                    x={30} y={gy + 3}
                    textAnchor="end" fontSize="8"
                    fill="var(--color-text-tertiary)"
                  >
                    {tick >= 60 ? `${tick / 60}h` : `${tick}m`}
                  </text>
                </g>
              );
            })}

            {/* Y 轴基线 */}
            <line x1={32} y1={0} x2={32} y2={BAR_H}
              stroke="var(--color-border)" strokeWidth="0.5" />

            {/* 柱子 */}
            {days.map((d, i) => {
              const x = 32 + i * (BAR_W + GAP);
              const barH = d.mins > 0 ? Math.max(4, (d.mins / Y_MAX) * BAR_H) : 0;
              const y = BAR_H - barH;
              const isToday = i === 6;
              return (
                <g key={d.key}>
                  <rect x={x} y={0} width={BAR_W} height={BAR_H} rx={4} fill="var(--color-bg-tertiary)" />
                  {d.mins > 0 && (
                    <rect x={x} y={y} width={BAR_W} height={barH} rx={4}
                      fill="var(--color-accent)" opacity={isToday ? 1 : 0.55}
                      className="asha-grow-bar" />
                  )}
                  {d.mins > 0 && (
                    <text x={x + BAR_W / 2} y={y - 5} textAnchor="middle" fontSize="8" fill="var(--color-text-tertiary)">
                      {d.mins >= 60 ? `${(d.mins/60).toFixed(1)}h` : `${Math.round(d.mins)}m`}
                    </text>
                  )}
                  <text
                    x={x + BAR_W / 2} y={BAR_H + 14}
                    textAnchor="middle" fontSize="8"
                    fill={isToday ? "var(--color-accent)" : "var(--color-text-tertiary)"}
                    fontWeight={isToday ? 600 : 400}
                  >
                    {shortWeekday(d.key, locale)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

// ─── 习惯热力图（GitHub contribution graph 风格，横置大图版）──────────────────
function HabitHeatmap({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const { habits } = useHabitStore();

  const WEEKS = 5;
  const CELL  = 22;
  const GAP   = 5;
  const DOW_W = 26;

  const grid = useMemo(() => {
    return Array.from({ length: WEEKS * 7 }, (_, i) => {
      const key = dateKey(i - (WEEKS * 7 - 1));
      const count = habits.filter(h => h.checkIns.includes(key)).length;
      return { key, count };
    });
  }, [habits]);

  const maxCount = Math.max(...grid.map(g => g.count), 1);

  // 月份标签：提取每周第一天所在月份，去重
  const monthLabels = useMemo(() => {
    const labels: { x: number; label: string }[] = [];
    for (let w = 0; w < WEEKS; w++) {
      const cellIdx = w * 7;
      const d = new Date(grid[cellIdx].key + 'T12:00:00');
      const m = lang === 'zh'
        ? `${d.getMonth() + 1}月`
        : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
      if (labels.length === 0 || labels[labels.length - 1].label !== m) {
        const xVal = DOW_W + GAP + w * (CELL + GAP);
        labels.push({ x: xVal, label: m });
      }
    }
    return labels;
  }, [grid, lang]);

  // 星期标签
  const dowLabels = lang === 'zh'
    ? ['', '一', '', '三', '', '五', '']
    : ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  const topStreak = useMemo(() => {
    if (!habits.length) return 0;
    return Math.max(...habits.map(h => calcStreak(new Set(h.checkIns))));
  }, [habits]);

  if (!habits.length) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <Flame size={16} style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
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
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Flame size={16} style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {t('insights.habitTitle')}
          </span>
        </div>
        {topStreak > 0 && (
          <span style={{ fontSize: '11px', color: '#f59e0b' }}>
            🔥 {lang === 'zh' ? `最长 ${topStreak} 天` : `Best ${topStreak}d streak`}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
        {/* 星期标签列 */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: `${GAP}px`,
          width: DOW_W, flexShrink: 0, marginTop: '18px',
        }}>
          {dowLabels.map((d, i) => (
            <div key={i} style={{
              height: CELL, display: 'flex', alignItems: 'center',
              justifyContent: 'flex-end', paddingRight: 4,
              fontSize: '9px', color: 'var(--color-text-tertiary)',
              lineHeight: 1,
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
                left: ml.x - DOW_W - GAP,
                fontSize: '9px',
                fontWeight: 500,
                color: 'var(--color-text-tertiary)',
                whiteSpace: 'nowrap',
              }}>
                {ml.label}
              </div>
            ))}
          </div>

          {/* 实际格子 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${WEEKS}, ${CELL}px)`,
            gridTemplateRows: `repeat(7, ${CELL}px)`,
            gap: `${GAP}px`,
          }}>
            {grid.map((cell, idx) => {
              const opacity = cell.count === 0 ? 0 : 0.15 + 0.85 * (cell.count / maxCount);
              const isToday = cell.key === dateKey(0);
              return (
                <div
                  key={cell.key}
                  title={`${cell.key}: ${cell.count} habit${cell.count !== 1 ? 's' : ''}`}
                  style={{
                    width: CELL, height: CELL, borderRadius: 3,
                    backgroundColor: cell.count > 0 ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                    opacity: cell.count > 0 ? opacity : 1,
                    outline: isToday ? `1.5px solid var(--color-accent)` : 'none',
                    outlineOffset: -1,
                    cursor: 'default',
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* 图例 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '12px', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '9px', color: 'var(--color-text-tertiary)' }}>
          {lang === 'zh' ? '少' : 'Less'}
        </span>
        {[0, 0.25, 0.5, 0.75, 1].map((o, i) => (
          <svg key={i} width={12} height={12} style={{ display: 'inline-block' }}>
            <rect x={0} y={0} width={12} height={12} rx={2}
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

// ─── 数据速览（近14天）────────────────────────────────────────────────────────
function QuickStats({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const { completedWorkSessions, settings, sessionLog, dailyFocusMinutes } = useFocusStore();
  const { habits } = useHabitStore();
  const { todos } = useTodoStore();
  const completionTimes = useCompletionStore((s) => s.completionTimes);

  // 14 天前起点
  const cutoff = dateKey(-13);

  // 近14天专注分钟（dailyFocusMinutes 实时数据 + sessionLog 已完成的 session 并集）
  const focusMins14 = useMemo(() => {
    const total: Record<string, number> = {};
    // 合并 dailyFocusMinutes
    for (const [key, val] of Object.entries(dailyFocusMinutes)) {
      if (key >= cutoff) total[key] = val;
    }
    // 合并 sessionLog
    for (const e of sessionLog) {
      if (e.date >= cutoff) {
        total[e.date] = Math.max(total[e.date] ?? 0, e.minutes);
      }
    }
    return Object.values(total).reduce((a, b) => a + b, 0);
  }, [sessionLog, dailyFocusMinutes, cutoff]);

  // 近14天有打卡的习惯数
  const activeHabits14 = useMemo(() => {
    return habits.filter(h => h.checkIns.some(ci => ci >= cutoff)).length;
  }, [habits, cutoff]);

  // 近14天完成 vs 创建的待办
  const todos14 = useMemo(() => {
    const done = Object.values(completionTimes).filter(iso => toDateKey(new Date(iso)) >= cutoff).length;
    // 创建数近似：最近14天完成的，加上未完成但创建日期在14天内的
    const created = todos.filter(t => toDateKey(new Date(t.createdAt)) >= cutoff).length;
    return { done, created: Math.max(created, done) };
  }, [todos, completionTimes, cutoff]);

  // 近14天专注次数
  const sessions14 = useMemo(() => {
    return sessionLog.filter(e => e.date >= cutoff).length;
  }, [sessionLog, cutoff]);

  const totalHabits = habits.length;

  const stats = [
    {
      icon: <Clock size={16} style={{ color: "var(--color-accent)" }} />,
      value: `${(focusMins14 / 60).toFixed(1)}h`,
      label: lang === "zh" ? "专注时长" : "Focus Time",
    },
    {
      icon: <Flame size={16} style={{ color: "#f59e0b" }} />,
      value: `${activeHabits14}/${totalHabits}`,
      label: lang === "zh" ? "习惯打卡" : "Habit Days",
    },
    {
      icon: <CheckCircle2 size={16} style={{ color: "#6a9bcc" }} />,
      value: `${todos14.done}/${todos14.created}`,
      label: lang === "zh" ? "待办完成" : "Todos Done",
    },
    {
      icon: <Target size={16} style={{ color: "#788c5d" }} />,
      value: `${sessions14}`,
      label: lang === "zh" ? "番茄个数" : "Pomodoros",
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Target size={16} style={{ color: "var(--color-text-secondary)" }} />
          <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>
            {t("insights.statsTitle")}
          </span>
        </div>
        <span style={{ fontSize: "11px", color: "var(--color-text-tertiary)" }}>
          {lang === "zh" ? "近14天" : "Last 14 days"}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
        {stats.map((s, i) => (
          <div
            key={i}
            style={{
              padding: "12px 10px",
              borderRadius: "8px",
              background: "var(--color-bg-tertiary)",
              border: "0.5px solid var(--color-border)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
              textAlign: "center",
            }}
          >
            {s.icon}
            <span style={{ fontSize: "17px", fontWeight: 600, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>
              {s.value}
            </span>
            <span style={{ fontSize: "10px", fontWeight: 500, color: "var(--color-text-secondary)", lineHeight: 1.2 }}>
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
  const lang = i18n.language.startsWith("zh") ? "zh" : "en";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingBottom: "16px" }}>
      {/* growBar 关键帧注入 */}
      <style>{GROW_BAR_STYLE}</style>

      {/* 顶部统计行 */}
      <TopStatRow lang={lang} />
      <div style={{ height: "0.5px", background: "var(--color-border)", margin: "18px 0 10px" }} />

      <QuickStats lang={lang} />
      <div style={{ height: "0.5px", background: "var(--color-border)", margin: "14px 0 10px" }} />

      <CompletionTrendChart lang={lang} />
      <div style={{ height: "0.5px", background: "var(--color-border)", margin: "14px 0 10px" }} />
      <FocusBarChart lang={lang} />
      <div style={{ height: "0.5px", background: "var(--color-border)", margin: "14px 0 10px" }} />
      <HabitHeatmap lang={lang} />
    </div>
  );
}
