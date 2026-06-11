import { useEffect, useState, type ComponentType, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Timer, Flame } from 'lucide-react';
import { useSheet } from '../lib/responsive';
import { useTodoStore } from '../store/todoStore';
import { useCompletionStore } from '../store/completionStore';
import { useFocusStore } from '../store/focusStore';
import { useHabitStore } from '../store/habitStore';
import BrandMark from './BrandMark';

/**
 * DailyAchievementModal — 每日成就弹窗
 *
 * 触发方式：
 *  1. 每日定时（App.tsx 调度 window.dispatchEvent(new CustomEvent('show-achievement'))）
 *  2. Header 手动触发
 *
 * 设计基调：冷静克制的「数据回顾」而非庆祝弹窗 ——
 * 排版分层（eyebrow → 日期大字 → 数据 → 一句话），无渐变、无装饰圆、
 * 无 emoji；信息本身即奖励。
 */

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DailyAchievementModal() {
  const [visible, setVisible] = useState(false);
  const sheet = useSheet();
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';

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

  const completedTodayCount = todos.filter((td) => {
    if (!td.completed) return false;
    const ts = completionTimes[td.id];
    return ts ? ts.slice(0, 10) === todayKey : false;
  }).length;

  const focusMinutesToday = sessionLog
    .filter((e) => e.date === todayKey)
    .reduce((sum, e) => sum + e.minutes, 0);

  const habitsCheckedToday = habits.filter((h) =>
    Array.isArray(h.checkIns) && h.checkIns.includes(todayKey)
  ).length;

  const totalHabits = habits.length;

  // 每日一句 — 按星期取，i18n
  const motivation = t(`achievement.motivation${new Date().getDay() % 5}`);

  const dateLabel = new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'long', day: 'numeric', weekday: lang === 'zh' ? 'short' : 'long',
  });

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
          <div className={`fixed inset-0 z-50 flex justify-center pointer-events-none ${sheet.alignClass}`}>
            <motion.div
              {...sheet.motion}
              className="pointer-events-auto overflow-hidden"
              style={{
                ...(sheet.isPhone
                  ? { width: '100%', borderRadius: '20px 20px 0 0', paddingBottom: 'var(--safe-bottom)' }
                  : { width: 'min(360px, 90vw)', borderRadius: '16px' }),
                backgroundColor: 'var(--color-bg-primary)',
                border: '0.5px solid var(--color-border)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {/* 头部 — 纯排版分层，无装饰 */}
              <div style={{ padding: '26px 26px 0' }}>
                <div className="flex items-center" style={{ gap: '8px', marginBottom: '14px' }}>
                  <BrandMark size={18} />
                  <span style={{
                    fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em',
                    textTransform: 'uppercase', color: 'var(--color-text-tertiary)',
                  }}>
                    {t('achievement.title')}
                  </span>
                </div>
                <h2 style={{
                  fontSize: '21px', fontWeight: 650, lineHeight: 1.2,
                  color: 'var(--color-text-primary)', letterSpacing: 'var(--tracking-tight)',
                }}>
                  {dateLabel}
                </h2>
              </div>

              {/* 数据区 — 三列大数字，分隔线上下收束 */}
              <div
                className="flex"
                style={{
                  margin: '18px 26px 0',
                  padding: '14px 0',
                  borderTop: '0.5px solid var(--color-separator)',
                  borderBottom: '0.5px solid var(--color-separator)',
                }}
              >
                <Stat
                  value={completedTodayCount}
                  unit={t('achievement.unitItems')}
                  label={t('achievement.statTodos')}
                  icon={CheckCircle2}
                  delay={0.08}
                />
                <StatDivider />
                <Stat
                  value={focusMinutesToday}
                  unit={t('achievement.unitMinutes')}
                  label={t('achievement.statFocus')}
                  icon={Timer}
                  delay={0.16}
                />
                <StatDivider />
                <Stat
                  value={habitsCheckedToday}
                  unit={`/ ${totalHabits}`}
                  label={t('achievement.statHabits')}
                  icon={Flame}
                  delay={0.24}
                />
              </div>

              {/* 一句话 — 安静收尾 */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.32, duration: 0.25 }}
                style={{
                  margin: '14px 26px 0',
                  fontSize: '12px',
                  color: 'var(--color-text-tertiary)',
                  lineHeight: 1.7,
                }}
              >
                — {motivation}
              </motion.p>

              {/* 底部按钮 */}
              <div style={{ padding: '18px 26px 22px' }}>
                <button
                  onClick={() => setVisible(false)}
                  className="w-full flex items-center justify-center cursor-pointer transition-colors"
                  style={{
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--clay)',
                    color: '#fff',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--clay-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--clay)'; }}
                >
                  {t('achievement.button')}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── 统计项 — 大数字 + 图标标签，无卡片边框 ───────────────────────────────
function Stat({
  value, unit, label, icon: Icon, delay,
}: {
  value: number;
  unit: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; style?: CSSProperties }>;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25, ease: 'easeOut' }}
      className="flex-1 flex flex-col items-center"
      style={{ gap: '4px' }}
    >
      <div className="flex items-baseline" style={{ gap: '2px' }}>
        <span style={{
          fontSize: '24px', fontWeight: 650, lineHeight: 1,
          color: 'var(--color-text-primary)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: 'var(--tracking-tight)',
        }}>
          {value}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
          {unit}
        </span>
      </div>
      <div className="flex items-center" style={{ gap: '4px' }}>
        <Icon size={11} strokeWidth={1.8} style={{ color: 'var(--clay)' }} />
        <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
          {label}
        </span>
      </div>
    </motion.div>
  );
}

function StatDivider() {
  return <div style={{ width: '0.5px', backgroundColor: 'var(--color-separator)', alignSelf: 'stretch' }} />;
}
