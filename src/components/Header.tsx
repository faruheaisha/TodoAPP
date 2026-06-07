import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Moon, Sun } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { motion } from 'framer-motion';

export default function Header() {
  const { t } = useTranslation();
  const { theme, setTheme, language, setLanguage } = useSettingsStore();
  const [showLangMenu, setShowLangMenu] = useState(false);

  return (
    <header
      className="flex items-center border-b flex-shrink-0"
      style={{
        height: 'var(--header-h)',
        padding: '8px 14px',
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg-primary)',
        gap: '8px',
      }}
    >
      {/* Logo */}
      <div
        className="rounded-full flex items-center justify-center flex-shrink-0"
        style={{ width: '28px', height: '28px', backgroundColor: 'var(--clay)' }}
      >
        <span className="text-xs font-bold" style={{ color: 'var(--ivory-light)' }}>
          T
        </span>
      </div>

      {/* Title */}
      <h1
        className="text-[16px] font-semibold select-none app-title"
        style={{
          color: 'var(--color-text-primary)',
          letterSpacing: 'var(--tracking-normal)',
        }}
      >
        {t('app.title')}
      </h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Controls */}
      <div className="flex items-center" style={{ gap: '4px' }}>
        {/* Language Switcher */}
        <div className="relative" title={language === 'zh' ? 'Switch to English' : '切换到中文'}>
          <LanguageButton label={language === 'zh' ? '中' : 'EN'} onClick={() => setShowLangMenu(!showLangMenu)} />
          {showLangMenu && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute right-0 top-full mt-1 rounded-lg border shadow-lg overflow-hidden z-50"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
              }}
            >
              <button
                onClick={() => { setLanguage('zh'); setShowLangMenu(false); }}
                className="w-full px-4 py-2 text-sm text-left transition-colors"
                style={{ color: 'var(--color-text-primary)' }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                {'中文'}
              </button>
              <button
                onClick={() => { setLanguage('en'); setShowLangMenu(false); }}
                className="w-full px-4 py-2 text-sm text-left transition-colors border-t"
                style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                English
              </button>
            </motion.div>
          )}
        </div>

        {/* Theme Toggle */}
        <IconButton
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          title={theme === 'light' ? '切换到深色模式' : 'Switch to light mode'}
          color="var(--color-text-secondary)"
        >
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
        </IconButton>

        {/* Settings */}
        <SettingsButton />
      </div>
    </header>
  );
}

function IconButton({ onClick, title, children, color }: { onClick: () => void; title?: string; children: React.ReactNode; color?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center border transition-all flex-shrink-0"
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '5px',
        borderColor: 'var(--color-border)',
        backgroundColor: 'transparent',
        color: color ?? 'var(--color-text-secondary)',
      }}
    >
      {children}
    </button>
  );
}

function LanguageButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center border text-xs font-medium transition-all flex-shrink-0"
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '5px',
        borderColor: 'var(--color-border)',
        backgroundColor: 'transparent',
        color: 'var(--color-text-secondary)',
      }}
    >
      {label}
    </button>
  );
}

function SettingsButton() {
  const { t } = useTranslation();
  const { isOpen, setIsOpen } = useSettingsStore();

  return (
    <IconButton
      onClick={() => setIsOpen(!isOpen)}
      title={t('settings.title')}
      color={isOpen ? 'var(--clay)' : 'var(--color-text-secondary)'}
    >
      <Settings size={14} />
    </IconButton>
  );
}
