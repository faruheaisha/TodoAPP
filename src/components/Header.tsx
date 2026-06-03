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
      className="flex items-center gap-3 px-5 py-3 border-b"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg-primary)',
      }}
    >
      {/* Logo */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'var(--color-accent)' }}
      >
        <span className="text-xs font-bold" style={{ color: '#FAF9F7' }}>
          T
        </span>
      </div>

      {/* Title */}
      <h1 className="text-[16px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        {t('app.title')}
      </h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Language Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all hover:bg-opacity-80 border"
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
                onClick={() => {
                  setLanguage('zh');
                  setShowLangMenu(false);
                }}
                className="w-full px-4 py-2 text-sm text-left transition-colors"
                style={{ color: 'var(--color-text-primary)' }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                中文
              </button>
              <button
                onClick={() => {
                  setLanguage('en');
                  setShowLangMenu(false);
                }}
                className="w-full px-4 py-2 text-sm text-left transition-colors border-t"
                style={{
                  color: 'var(--color-text-primary)',
                  borderColor: 'var(--color-border)',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                English
              </button>
            </motion.div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="w-7 h-7 rounded-md flex items-center justify-center border transition-all hover:bg-opacity-80"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'transparent',
            color: 'var(--color-text-secondary)',
          }}
        >
          {theme === 'light' ? (
            <Moon size={14} />
          ) : (
            <Sun size={14} />
          )}
        </button>

        {/* Settings Button */}
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
      className={`w-7 h-7 rounded-md flex items-center justify-center border transition-all hover:bg-opacity-80 ${isOpen ? 'ring-2'}`}
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'transparent',
        color: 'var(--color-text-secondary)',
        ringColor: 'var(--color-accent)',
      }}
      title={t('settings.title')}
    >
      <Settings size={14} />
    </button>
  );
}
