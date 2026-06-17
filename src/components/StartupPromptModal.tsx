import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useSheet } from '../lib/responsive';
import { useTodoStore } from '../store/todoStore';
import { useCompletionStore } from '../store/completionStore';
import { isAfter, isBefore, startOfDay, parseISO } from 'date-fns';
import { X, CalendarClock, AlertTriangle } from 'lucide-react';
import { localDateKey } from '../lib/utils';

export function StartupPromptModal() {
  const [visible, setVisible] = useState(false);
  const sheet = useSheet();
  const { t } = useTranslation();

  const todos = useTodoStore((s) => s.todos);
  const completionTimes = useCompletionStore((s) => s.completionTimes);

  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener('show-startup-prompt', handler);
    return () => window.removeEventListener('show-startup-prompt', handler);
  }, []);

  const todayStart = startOfDay(new Date()).getTime();

  const overdue = todos.filter((td) => {
    if (td.completed || !td.deadline) return false;
    return isBefore(parseISO(td.deadline), todayStart);
  });

  const dueToday = todos.filter((td) => {
    if (td.completed || !td.deadline) return false;
    const d = parseISO(td.deadline);
    return isAfter(d, todayStart - 1) && isBefore(d, todayStart + 86400000);
  });

  const completedToday = todos.filter((td) => {
    if (!td.completed) return false;
    const ts = completionTimes[td.id];
    return ts ? localDateKey(new Date(ts)) === localDateKey() : false;
  }).length;

  const totalActive = todos.filter((td) => !td.completed).length;

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
            onClick={() => setVisible(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="pointer-events-auto rounded-xl"
              style={{
                width: 'min(400px, 90vw)',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '0.5px solid var(--color-border)',
                boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{
                padding: '18px 20px 14px',
                borderBottom: '0.5px solid var(--color-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--clay)', opacity: 0.8, marginBottom: 2 }}>
                    {t('notifications.startup.title')}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', weekday: 'short' })}
                  </div>
                </div>
                <button onClick={() => setVisible(false)}
                  style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', display: 'grid', placeItems: 'center' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-tertiary)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Stats row */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{
                    flex: 1, background: 'var(--color-bg-tertiary)', borderRadius: 8, padding: '10px 12px',
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--color-text-tertiary)' }}>
                      {t('app.items')}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' }}>{totalActive}</div>
                  </div>
                  <div style={{
                    flex: 1, background: 'var(--color-bg-tertiary)', borderRadius: 8, padding: '10px 12px',
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--color-text-tertiary)' }}>
                      {t('app.completed')}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--olive)' }}>{completedToday}</div>
                  </div>
                </div>

                {/* Overdue */}
                {overdue.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fig)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={12} /> {t('app.todayOverdue')} ({overdue.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {overdue.slice(0, 5).map((td) => (
                        <div key={td.id} style={{
                          fontSize: 12, color: 'var(--color-text-secondary)', padding: '4px 8px',
                          background: 'var(--color-bg-primary)', borderRadius: 6,
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--fig)', flexShrink: 0 }} />
                          <span className="truncate">{td.title}</span>
                        </div>
                      ))}
                      {overdue.length > 5 && (
                        <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textAlign: 'center', paddingTop: 2 }}>
                          +{overdue.length - 5} {t('app.items')}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Due today */}
                {dueToday.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--clay)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CalendarClock size={12} /> {t('app.todayDue')} ({dueToday.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {dueToday.slice(0, 5).map((td) => (
                        <div key={td.id} style={{
                          fontSize: 12, color: 'var(--color-text-secondary)', padding: '4px 8px',
                          background: 'var(--color-bg-primary)', borderRadius: 6,
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--clay)', flexShrink: 0 }} />
                          <span className="truncate">{td.title}</span>
                        </div>
                      ))}
                      {dueToday.length > 5 && (
                        <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textAlign: 'center', paddingTop: 2 }}>
                          +{dueToday.length - 5} {t('app.items')}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {overdue.length === 0 && dueToday.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '14px 0', color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                    {t('app.todayEmpty')}
                  </div>
                )}

                {/* CTA */}
                <button onClick={() => setVisible(false)}
                  style={{
                    width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: 'var(--clay)', color: '#fff', fontSize: 12.5, fontWeight: 500,
                    transition: 'opacity .15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                >
                  {t('notifications.startup.open')}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
