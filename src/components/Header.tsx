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
      className="flex items-center gap-3 px-5 py-2.5 border-b"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg-primary)',
      }}
    >
      {/* Logo — Clay 橙色 */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'var(--clay)' }}
      >
        <span className="text-xs font-bold" style={{ color: 'var(--ivory-light)' }}>
          T
        </span>
      </div>

      {/* Title */}
      <h1
        className="text-[16px] font-semibold select-none"
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
      <div className="flex items-center gap-2">
        {/* Language Switcher — with tooltip */}
        <div className="relative" title={language === 'zh' ? 'Switch to English' : '切换到中文'}>
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="px-2.5 py-1.5 rounded text-xs font-medium transition-all border"
            style={{
              color: 'var(--color-text-secondary)',
              borderColor: 'var(--color-border)',
              backgroundColor: 'transparent',
            }}
          >
            {language === 'zh' ? '中' : 'EN'}
          </button>
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
                中文
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

        {/* Theme Toggle — with tooltip */}
        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="w-7 h-7 rounded flex items-center justify-center border transition-all"
          title={theme === 'light' ? '切换到深色模式' : 'Switch to light mode'}
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'transparent',
            color: 'var(--color-text-secondary)',
          }}
        >
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
        </button>

        {/* Settings Button — with tooltip */}
        <SettingsButton />
      </div>
    </header>
  );
}

function SettingsButton() {
  const { t } = useTranslation();
  const { isOpen, setIsOpen } = useSettingsStore();

  return (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className="w-7 h-7 rounded flex items-center justify-center border transition-all"
      title={t('settings.title')}
      style={{
        borderColor: isOpen ? 'var(--clay)' : 'var(--color-border)',
        backgroundColor: 'transparent',
        color: isOpen ? 'var(--clay)' : 'var(--color-text-secondary)',
      }}
    >
      <Settings size={14} />
    </button>
  );
}