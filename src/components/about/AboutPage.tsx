import React from 'react';
import { motion } from 'framer-motion';
import { X, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BrandLogo from './BrandLogo';
import { useSettingsStore } from '../../store/settingsStore';

interface AboutPageProps {
  onClose: () => void;
  onBackToSettings?: () => void;
}

type LegalDoc = 'privacy' | 'terms';

const promiseCards = {
  zh: [
    { title: '本地优先', body: '任务、习惯、计时与洞察默认留在你的设备里。' },
    { title: 'AI 工作流', body: '把模糊想法拆成可执行清单，再进入专注节奏。' },
    { title: '永久免费', body: '无需账号、无需订阅，保持一个安静的个人工具。' },
  ],
  en: [
    { title: 'Local-first', body: 'Tasks, habits, timers and insights stay on your device by default.' },
    { title: 'AI workflows', body: 'Turn vague intent into executable tasks and focused sessions.' },
    { title: 'Free forever', body: 'No account, no subscription, no noisy growth mechanics.' },
  ],
};

const features = {
  zh: [
    ['Chat', '和 Asha 对话，澄清下一步'],
    ['Quadrant', '用四象限识别真正重要的事'],
    ['Insights', '从完成记录里看到节奏'],
    ['Pomodoro', '把任务推进到专注时间块'],
    ['Habit', '让重复行动变成可见轨迹'],
    ['Calendar', '把长期目标放回日期里'],
  ],
  en: [
    ['Chat', 'Clarify the next move with Asha'],
    ['Quadrant', 'Separate important work from noise'],
    ['Insights', 'See your execution rhythm over time'],
    ['Pomodoro', 'Move tasks into focused time blocks'],
    ['Habit', 'Make repeated actions visible'],
    ['Calendar', 'Put long-term goals back on dates'],
  ],
};

function StatPill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '6px 12px', borderRadius: 999,
      background: 'var(--clay-light)', color: 'var(--clay)',
      fontSize: 11, fontWeight: 700, letterSpacing: '.02em', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase',
      color: 'var(--clay)', marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function MiniTodoMock() {
  return (
    <div style={{
      width: 'min(420px, 100%)', margin: '28px auto 0', padding: 12,
      borderRadius: 18, border: '0.5px solid var(--glass-border)',
      background: 'var(--glass-bg)', boxShadow: 'var(--shadow-float)',
      textAlign: 'left', backdropFilter: 'blur(14px)',
    }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97757' }} />
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e3dacc' }} />
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#788c5d' }} />
      </div>
      {[
        ['AI 拆解：准备产品发布', '4 subtasks'],
        ['完成隐私政策草稿', 'Today'],
        ['整理本周执行洞察', 'Friday'],
      ].map((row, i) => (
        <div key={row[0]} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px',
          borderRadius: 10, background: i === 0 ? 'var(--color-bg-tertiary)' : 'transparent',
        }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', border: i === 1 ? '1.5px solid var(--olive)' : '1.5px solid var(--color-border)' }} />
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>{row[0]}</span>
          <span style={{ fontSize: 10, color: i === 0 ? 'var(--clay)' : 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>{row[1]}</span>
        </div>
      ))}
    </div>
  );
}

function LegalBlock({ doc, lang }: { doc: LegalDoc; lang: 'zh' | 'en' }) {
  const [open, setOpen] = React.useState(false);
  const [content, setContent] = React.useState('');

  React.useEffect(() => {
    if (!open || content) return;
    const loader = doc === 'privacy'
      ? (lang === 'zh' ? import('../../legal/privacy_zh.md?raw') : import('../../legal/privacy_en.md?raw'))
      : (lang === 'zh' ? import('../../legal/tos_zh.md?raw') : import('../../legal/tos_en.md?raw'));
    loader.then((mod) => setContent(mod.default));
  }, [open, content, doc, lang]);

  const title = doc === 'privacy'
    ? (lang === 'zh' ? '隐私政策' : 'Privacy Policy')
    : (lang === 'zh' ? '服务条款' : 'Terms of Service');

  return (
    <div style={{ borderBottom: '0.5px solid rgba(255,255,255,.12)' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 0', border: 'none', background: 'transparent', cursor: 'pointer',
        color: '#faf9f5', fontSize: 14, fontWeight: 650,
      }}>
        {title}<span style={{ color: '#d97757' }}>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <motion.pre initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} style={{
          whiteSpace: 'pre-wrap', margin: '0 0 18px', color: '#b0aea5',
          fontFamily: 'var(--font-family)', fontSize: 12, lineHeight: 1.75,
        }}>
          {content || (lang === 'zh' ? '加载中…' : 'Loading…')}
        </motion.pre>
      )}
    </div>
  );
}

export default function AboutPage({ onClose, onBackToSettings }: AboutPageProps) {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const lang = language as 'zh' | 'en';
  const copy = lang === 'zh' ? {
    tagline: '你的本地 AI 效率驾驶舱',
    cta: '返回设置',
    promises: 'Core promises',
    features: 'Service contents',
    positioning: 'Product positioning',
    privacy: 'Privacy and service',
    showcase: 'AI task breakdown',
    positionBody: 'TodoApp 不是另一个沉重的项目管理系统，而是一个安静、轻量、围绕个人执行建立的桌面工作台。它把待办、番茄钟、习惯、四象限、洞察图和 AI 对话放在同一个本地空间里，帮助你从“想到一件事”自然走到“把它完成”。',
    legalBody: '我们采用本地优先的产品逻辑：默认不需要账号，不强制云同步。只有当你主动配置 WebDAV 备份或 AI 服务时，相关数据才会按照你的设置离开本机。',
    built: 'Built with Tauri v2, React 19 and a local-first product philosophy.',
  } : {
    tagline: 'Your local AI productivity cockpit',
    cta: 'Back to Settings',
    promises: 'Core promises',
    features: 'Service contents',
    positioning: 'Product positioning',
    privacy: 'Privacy and service',
    showcase: 'AI task breakdown',
    positionBody: 'TodoApp is not another heavy project management system. It is a quiet, lightweight desktop cockpit for personal execution, bringing todos, focus sessions, habits, quadrants, insights and AI conversation into one local space.',
    legalBody: 'TodoApp follows a local-first product logic: no account by default, no forced cloud sync. Data leaves your device only when you explicitly configure WebDAV backup or AI services.',
    built: 'Built with Tauri v2, React 19 and a local-first product philosophy.',
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60]" style={{ background: 'rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 18 }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 18, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: .985 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }} className="about-modal scroll-hidden" style={{
        position: 'relative', width: 'min(820px, 94vw)', height: 'min(600px, 90vh)', margin: '0 auto',
        overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', borderRadius: 24, background: 'var(--color-bg-secondary)',
        border: '0.5px solid var(--color-border)', boxShadow: 'var(--shadow-float)',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 0', pointerEvents: 'none',
        }}>
          <button onClick={onBackToSettings ?? onClose} aria-label={lang === 'zh' ? '返回设置' : 'Back to settings'} style={{
            pointerEvents: 'auto', height: 34, padding: '0 12px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 7,
            border: '0.5px solid var(--color-border)', background: 'color-mix(in srgb, var(--color-bg-secondary) 82%, transparent)',
            color: 'var(--color-text-secondary)', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', backdropFilter: 'blur(14px)',
            fontSize: 12, fontWeight: 700,
          }}>
            <ArrowLeft size={14} />
            {lang === 'zh' ? '设置' : 'Settings'}
          </button>
          <button onClick={onClose} aria-label="Close" style={{
            pointerEvents: 'auto', width: 34, height: 34, borderRadius: 11, display: 'grid', placeItems: 'center',
            border: '0.5px solid var(--color-border)', background: 'color-mix(in srgb, var(--color-bg-secondary) 82%, transparent)',
            color: 'var(--color-text-tertiary)', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', backdropFilter: 'blur(14px)',
          }}><X size={16} /></button>
        </div>

        <section className="about-hero" style={{ padding: '28px 36px 38px', textAlign: 'center', background: 'radial-gradient(circle at 50% 0%, var(--clay-light), transparent 42%)' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}><BrandLogo width={180} /></div>
          <h1 style={{ margin: '22px auto 0', maxWidth: 720, fontSize: 'clamp(34px, 6vw, 64px)', lineHeight: .98, letterSpacing: '-0.055em', color: 'var(--color-text-primary)' }}>
            {copy.tagline}
          </h1>
          <p style={{ margin: '18px auto 0', maxWidth: 620, color: 'var(--color-text-secondary)', fontSize: 14, lineHeight: 1.75 }}>
            {copy.positionBody}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 22 }}>
            <StatPill>{lang === 'zh' ? '本地存储' : '100% Local'}</StatPill>
            <StatPill>{lang === 'zh' ? '无需账号' : 'No Sign-up'}</StatPill>
            <StatPill>{lang === 'zh' ? '永久免费' : 'Free Forever'}</StatPill>
          </div>
          <button onClick={onBackToSettings ?? onClose} style={{ marginTop: 24, padding: '11px 22px', borderRadius: 10, border: 'none', background: 'var(--clay)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
            {copy.cta} →
          </button>
          <MiniTodoMock />
        </section>

        <section className="about-content" style={{ padding: '8px 36px 56px' }}>
          <div className="about-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 34 }}>
            {promiseCards[lang].map((card, i) => (
              <div key={card.title} style={{ padding: 18, borderRadius: 16, background: 'var(--color-bg-tertiary)', border: '0.5px solid var(--color-border)' }}>
                <div style={{ width: 28, height: 28, borderRadius: 10, display: 'grid', placeItems: 'center', background: i === 1 ? 'var(--clay)' : 'var(--color-bg-secondary)', color: i === 1 ? '#fff' : 'var(--clay)', fontWeight: 800, marginBottom: 14 }}>{i + 1}</div>
                <h3 style={{ fontSize: 15, marginBottom: 8, color: 'var(--color-text-primary)' }}>{card.title}</h3>
                <p style={{ fontSize: 12, lineHeight: 1.65, color: 'var(--color-text-secondary)', margin: 0 }}>{card.body}</p>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 36 }}>
            <SectionLabel>{copy.features}</SectionLabel>
            <div className="scroll-x-snap scroll-hidden-x" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 10 }}>
              {features[lang].map(([title, body]) => (
                <div key={title} style={{ minWidth: 190, scrollSnapAlign: 'start', padding: 16, borderRadius: 16, background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', boxShadow: 'var(--color-card-shadow)' }}>
                  <div style={{ height: 68, borderRadius: 12, background: 'linear-gradient(135deg, var(--color-bg-tertiary), var(--clay-light))', marginBottom: 12, display: 'grid', placeItems: 'center', color: 'var(--clay)', fontSize: 22, fontWeight: 800 }}>{title.slice(0, 1)}</div>
                  <h4 style={{ margin: 0, fontSize: 13, color: 'var(--color-text-primary)' }}>{title}</h4>
                  <p style={{ margin: '5px 0 0', fontSize: 11.5, lineHeight: 1.55, color: 'var(--color-text-tertiary)' }}>{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="about-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'stretch', marginBottom: 36 }}>
            <div style={{ padding: 22, borderRadius: 18, background: 'var(--color-bg-tertiary)', border: '0.5px solid var(--color-border)' }}>
              <SectionLabel>{copy.positioning}</SectionLabel>
              <h2 style={{ margin: '0 0 12px', fontSize: 26, lineHeight: 1.08, letterSpacing: '-0.04em', color: 'var(--color-text-primary)' }}>
                {lang === 'zh' ? '为个人执行而生，不为团队管理制造噪音。' : 'Designed for personal execution, not team-management noise.'}
              </h2>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.75, color: 'var(--color-text-secondary)' }}>{copy.positionBody}</p>
            </div>
            <div style={{ padding: 22, borderRadius: 18, background: '#141413', color: '#faf9f5', border: '0.5px solid #2a2a28' }}>
              <SectionLabel>{copy.showcase}</SectionLabel>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.8, color: '#b0aea5' }}>
                <div style={{ color: '#d97757' }}>asha breakdown --goal "Launch product"</div>
                <div>1. clarify positioning</div>
                <div>2. draft privacy policy</div>
                <div>3. prepare launch checklist</div>
                <div style={{ color: '#788c5d' }}>done: next action generated</div>
              </div>
            </div>
          </div>

          <div style={{ padding: 24, borderRadius: 20, background: '#141413', border: '0.5px solid #2a2a28', marginBottom: 28 }}>
            <SectionLabel>{copy.privacy}</SectionLabel>
            <p style={{ margin: '0 0 8px', color: '#e8e6dc', fontSize: 13, lineHeight: 1.75 }}>{copy.legalBody}</p>
            <LegalBlock doc="privacy" lang={lang} />
            <LegalBlock doc="terms" lang={lang} />
          </div>

          <footer style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', paddingTop: 18, borderTop: '0.5px solid var(--color-border)', color: 'var(--color-text-tertiary)', fontSize: 11 }}>
            <span>{copy.built}</span>
            <span>{t('app.title')} · v0.1.0 · Tauri v2 · React 19</span>
          </footer>
        </section>
      </motion.div>
    </motion.div>
  );
}
