import { useTranslation } from 'react-i18next';

interface EmptyStateProps {
  kind?: 'active' | 'search';
}

export default function EmptyState({ kind = 'active' }: EmptyStateProps) {
  const { t } = useTranslation();

  const title = kind === 'search' ? t('app.emptySearchTitle') : t('app.empty');
  const sub = kind === 'search' ? t('app.emptySearchSub') : t('app.emptyHint');

  return (
    <div style={{
      display: 'grid', placeItems: 'center', padding: '56px 0 64px',
      animation: 'linear-fadeInUp .5s cubic-bezier(.22,.61,.36,1) both',
    }}>
      <div style={{ position: 'relative', width: 96, height: 96, marginBottom: 20 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 38%, #fff, #F2EEE9)',
          border: '0.5px solid var(--color-border)',
        }} />
        <svg width="96" height="96" viewBox="0 0 96 96" fill="none" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="48" cy="48" r="22" stroke="#E0DAD2" strokeWidth="1.5" />
          <path d="M38 49.5l7 7L60 41" stroke="var(--clay)" strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="72" cy="30" r="2.4" fill="var(--clay-light)" />
          <circle cx="24" cy="62" r="1.8" fill="#E0DAD2" />
          <circle cx="70" cy="64" r="1.6" fill="#E0DAD2" />
        </svg>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{
        fontSize: 13, color: 'var(--color-text-tertiary)', maxWidth: 280,
        textAlign: 'center', lineHeight: 1.6,
      }}>
        {sub}
      </div>
      {/* CTA button to focus input */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('focus-add-input'))}
        className="linear-ghost-btn"
        style={{ marginTop: 16, fontSize: 13, padding: '7px 14px', color: 'var(--clay)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
          <path d="M12 5v14" /><path d="M5 12h14" />
        </svg>
        {t('app.emptyCta')}
      </button>
    </div>
  );
}
