import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settingsStore';
import { useToolsPanelStore } from '../store/toolsStore';
import { useFocusStore } from '../store/focusStore';

function CheckMarkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4"
      strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <path d="M5 12.5l4.2 4.5L19 7" />
    </svg>
  );
}

function Icon({ d }: { d: React.ReactNode }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      {d}
    </svg>
  );
}

export default function Header() {
  const { t } = useTranslation();
  const { theme, setTheme, language, setLanguage } = useSettingsStore();
  const { isOpen, activeTool, openTool, setIsOpen } = useToolsPanelStore();
  const { isRunning, remainingSeconds } = useFocusStore();
  const settingsIsOpen = useSettingsStore((s) => s.isOpen);
  const setIsSettingsOpen = useSettingsStore((s) => s.setIsOpen);

  const showBadge = isRunning;
  const mm = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const ss = String(remainingSeconds % 60).padStart(2, '0');

  const ghostBtn = {
    appearance: 'none' as const, border: 'none' as const, background: 'transparent', cursor: 'pointer',
    font: 'inherit' as const, color: 'var(--ink-2)',
    display: 'inline-flex' as const, alignItems: 'center' as const, gap: '5px' as const,
    padding: '5px 9px' as const, borderRadius: '7px' as const,
    transition: 'background .14s ease,color .14s ease' as const,
    whiteSpace: 'nowrap' as const, lineHeight: 1 as const,
    fontSize: '12.5px' as const,
  };

  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px var(--pad-x)', borderBottom: '0.5px solid var(--color-border)',
    }}>
      {/* Left: coral square + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7, background: 'var(--clay)',
          display: 'grid', placeItems: 'center',
        }}>
          <CheckMarkIcon />
        </div>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {t('app.title')}
        </span>
      </div>

      {/* Right: action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* Language */}
        <button style={ghostBtn} onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}>
          {language === 'zh' ? '中' : 'EN'}
        </button>

        {/* Tools / Timer */}
        <button style={{
          ...ghostBtn,
          gap: showBadge ? '5px' : '0px',
          padding: showBadge ? '5px 9px' : '5px 9px',
          color: isOpen ? 'var(--clay)' : 'var(--ink-2)',
        }} onClick={() => (isOpen ? setIsOpen(false) : openTool(activeTool))}>
          <Icon d={<><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 1.5"/></>} />
          {showBadge && (
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--clay)', fontVariantNumeric: 'tabular-nums' }}>
              {mm}:{ss}
            </span>
          )}
        </button>

        {/* Theme toggle: light → dark → system → light */}
        <button style={ghostBtn} onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')}>
          <Icon d={
            theme === 'light'
              ? <><circle cx="12" cy="12" r="5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></>
              : theme === 'dark'
              ? <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></>
              : <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 20h8"/><path d="M12 17v3"/></>
          } />
        </button>

        {/* Settings - iOS style gear */}
        <button style={{
          ...ghostBtn,
          color: settingsIsOpen ? 'var(--clay)' : 'var(--ink-2)',
        }} onClick={() => setIsSettingsOpen(!settingsIsOpen)}>
          <svg width="17" height="17" viewBox="0 0 1024 1024" fill="none" stroke="currentColor"
            strokeWidth="59" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="M904.533 422.4l-85.333-14.933-17.067-38.4 49.067-70.4c14.933-21.333 12.8-49.067-6.4-68.267l-53.333-53.333c-19.2-19.2-46.933-21.334-68.267-6.4l-70.4 49.066-38.4-17.066-14.933-85.334c-2.134-23.466-23.467-42.666-49.067-42.666h-74.667c-25.6 0-46.933 19.2-53.333 44.8l-14.933 85.333-38.4 17.067L296.533 170.667c-21.333-14.934-49.067-12.8-68.266 6.4l-53.334 53.333c-19.2 19.2-21.333 46.933-6.4 68.267l49.067 70.4-17.067 38.4-85.333 14.933c-21.334 4.267-40.534 25.6-40.534 51.2v74.667c0 25.6 19.2 46.933 44.8 53.333l85.333 14.933 17.067 38.4L170.667 727.467c-14.933 21.333-12.8 49.067 6.4 68.266l53.333 53.334c19.2 19.2 46.933 21.333 68.267 6.4l70.4-49.067 38.4 17.067 14.933 85.333c4.267 25.6 25.6 44.8 53.333 44.8h74.667c25.6 0 46.933-19.2 53.333-44.8l14.934-85.333 38.4-17.067 70.4 49.067c21.333 14.933 49.067 12.8 68.266-6.4l53.334-53.334c19.2-19.2 21.333-46.933 6.4-68.266l-49.067-70.4 17.067-38.4 85.333-14.934c25.6-4.266 44.8-25.6 44.8-53.333v-74.667c-4.267-27.733-23.467-49.066-49.067-53.333z"/>
            <circle cx="512" cy="512" r="117.333"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
