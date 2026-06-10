import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTodoStore } from '../store/todoStore';
import { useCompletionStore } from '../store/completionStore';
import { useFocusStore } from '../store/focusStore';
import { useHabitStore } from '../store/habitStore';

/**
 * DailyAchievementModal — 每日成就弹窗
 *
 * 触发方式：
 *  1. 每日定时（App.tsx 调度 window.dispatchEvent(new CustomEvent('show-achievement'))）
 *  2. Header 手动触发
 *
 * 设计参考：
 * - Apple Activity Rings 的成就徽章风格（大数字 + 标签 + 激励文案）
 * - Customodoro 的 Stats & Analytics 面板布局（数据卡片网格）
 * - Habitica 的每日总结界面（庆祝感 + 成就感）
 */

const MOTIVATIONS = [
  '今天的你，超越了昨天的自己。',
  '一步一个脚印，持续积累的力量。',
  '每一个完成都是对自己承诺的兑现。',
  '专注，是送给自己最好的礼物。',
  '今天的坚持，是明天的底气。',
];

function getTodayMotivation(): string {
  const day = new Date().getDay();
  return MOTIVATIONS[day % MOTIVATIONS.length];
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DailyAchievementModal() {
  const [visible, setVisible] = useState(false);

  const todos = useTodoStore((s) => s.todos);
  const completionTimes = useCompletionStore((s) => s.completionTimes);
  const sessionLog = useFocusStore((s) => s.sessionLog);
  const habits = useHabitStore((s) => s.habits);

  // 监听全局事件
  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener('show-achievement', handler);
    return () => window.removeEventListener('show-achievement', handler);
  }, []);

  // 统计今日数据
  const todayKey = getTodayKey();

  const completedTodayCount = todos.filter((t) => {
    if (!t.completed) return false;
    const ts = completionTimes[t.id];
    return ts ? ts.slice(0, 10) === todayKey : false;
  }).length;

  const focusMinutesToday = sessionLog
    .filter((e) => e.date === todayKey)
    .reduce((sum, e) => sum + e.minutes, 0);

  const habitsCheckedToday = habits.filter((h) =>
    Array.isArray(h.checkIns) && h.checkIns.includes(todayKey)
  ).length;

  const totalHabits = habits.length;

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* 遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
            onClick={() => setVisible(false)}
          />

          {/* 弹窗主体 */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="pointer-events-auto overflow-hidden"
              style={{
                width: 'min(360px, 90vw)',
                borderRadius: '16px',
                backgroundColor: 'var(--color-bg-primary)',
                border: '0.5px solid var(--color-border)',
                boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
              }}
            >
              {/* 头部 — coral 渐变 */}
              <div
                className="flex flex-col items-center"
                style={{
                  padding: '28px 24px 20px',
                  background: 'linear-gradient(145deg, var(--clay) 0%, var(--clay-hover) 100%)',
                  position: 'relative',
                }}
              >
                {/* 背景装饰圆 */}
                <div style={{
                  position: 'absolute', top: -20, right: -20,
                  width: 100, height: 100, borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                }} />
                <div style={{
                  position: 'absolute', bottom: -30, left: -15,
                  width: 80, height: 80, borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                }} />

                {/* 奖杯图标 SVG */}
                <motion.div
                  initial={{ scale: 0, rotate: -12 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 14, stiffness: 200, delay: 0.1 }}
                  style={{
                    width: 56, height: 56, borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '10px', fontSize: '26px', flexShrink: 0,
                  }}
                >
                  🏆
                </motion.div>

                <span style={{ color: '#fff', fontSize: '11px', fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.85 }}>
                  今日成就
                </span>
                <span style={{ color: '#fff', fontSize: '18px', fontWeight: 700, marginTop: '2px', opacity: 0.95 }}>
                  {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}
                </span>
              </div>

              {/* 数据卡片区 */}
              <div style={{ padding: '20px 20px 0' }}>
                <div className="flex" style={{ gap: '10px' }}>
                  <StatCard
                    value={completedTodayCount}
                    unit="项"
                    label="任务完成"
                    color="var(--clay)"
                    emoji="✅"
                    delay={0.15}
                  />
                  <StatCard
                    value={focusMinutesToday}
                    unit="分钟"
                    label="专注时长"
                    color="var(--sky)"
                    emoji="⏱"
                    delay={0.22}
                  />
                  <StatCard
                    value={habitsCheckedToday}
                    unit={`/ ${totalHabits}`}
                    label="习惯打卡"
                    color="var(--olive)"
                    emoji="🔥"
                    delay={0.29}
                  />
                </div>

                {/* 激励文案 */}
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.38 }}
                  className="text-center text-sm"
                  style={{
                    margin: '16px 0 20px',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.6,
                    fontStyle: 'italic',
                  }}
                >
                  "{getTodayMotivation()}"
                </motion.p>
              </div>

              {/* 底部按钮 */}
              <div style={{ padding: '0 20px 20px' }}>
                <motion.button
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.44 }}
                  onClick={() => setVisible(false)}
                  className="w-full flex items-center justify-center font-semibold transition-all cursor-pointer"
                  style={{
                    height: '38px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--clay)',
                    color: '#fff',
                    border: 'none',
                    fontSize: '13px',
                    letterSpacing: '0.02em',
                  }}
                  whileHover={{ opacity: 0.9 }}
                  whileTap={{ scale: 0.97 }}
                >
                  收下成就 ✨
                </motion.button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── 统计卡片 ──────────────────────────────────────────────────────────

function StatCard({
  value, unit, label, color, emoji, delay,
}: {
  value: number;
  unit: string;
  label: string;
  color: string;
  emoji: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="flex-1 flex flex-col items-center"
      style={{
        padding: '12px 6px',
        borderRadius: '10px',
        backgroundColor: 'var(--color-bg-secondary)',
        border: '0.5px solid var(--color-border)',
        gap: '3px',
      }}
    >
      <span style={{ fontSize: '16px' }}>{emoji}</span>
      <div className="flex items-baseline" style={{ gap: '2px' }}>
        <span style={{ fontSize: '22px', fontWeight: 700, color, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
          {value}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', fontWeight: 400 }}>
          {unit}
        </span>
      </div>
      <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', textAlign: 'center', lineHeight: 1.2 }}>
        {label}
      </span>
    </motion.div>
  );
}
