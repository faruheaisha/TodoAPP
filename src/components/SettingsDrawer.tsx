import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settingsStore';
import { useTodoStore } from '../store/todoStore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Globe, Moon, Sun, Keyboard, FolderOpen, Save, Upload, FileText, FileJson, FileSpreadsheet } from 'lucide-react';
import { exportTodosJSON, exportTodosCSV } from '../lib/csv-export';

export default function SettingsDrawer() {
  const { t, i18n } = useTranslation();
  const {
    theme, setTheme, language, setLanguage,
    startupDelay, setStartupDelay, hotkey,
    downloadPath, setDownloadPath,
    isOpen, setIsOpen,
  } = useSettingsStore();
  const { todos } = useTodoStore();

  const today = new Date().toISOString().split('T')[0];

  // Close on ESC key
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, setIsOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Full modal backdrop — click to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 cursor-pointer"
            style={{ backgroundColor: 'var(--slate)' }}
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer — slides from right */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-[320px] z-50 border-l shadow-2xl overflow-y-auto"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              borderColor: 'var(--color-border)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)', letterSpacing: 'var(--tracking-normal)' }}>
                {t('settings.title')}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="w-6 h-6 rounded flex items-center justify-center"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                <X size={14} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">
              {/* Language */}
              <SettingItem icon={<Globe size={14} />} label={t('settings.language')}>
                <div className="flex gap-1">
                  <SelectBtn active={language === 'zh'} onClick={() => setLanguage('zh')} label="中文" />
                  <SelectBtn active={language === 'en'} onClick={() => setLanguage('en')} label="English" />
                </div>
              </SettingItem>

              {/* Theme */}
              <SettingItem icon={theme === 'light' ? <Sun size={14} /> : <Moon size={14} />} label={t('settings.theme')}>
                <div className="flex gap-1">
                  <SelectBtn active={theme === 'light'} onClick={() => setTheme('light')} label={t('settings.lightMode')} />
                  <SelectBtn active={theme === 'dark'} onClick={() => setTheme('dark')} label={t('settings.darkMode')} />
                </div>
              </SettingItem>

              {/* Startup Delay */}
              <SettingItem label={`${t('settings.startupDelay')}: ${startupDelay} ${t('settings.minutes')}`}>
                <input
                  type="range" min="1" max="30" value={startupDelay}
                  onChange={(e) => setStartupDelay(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: 'var(--clay)' }}
                />
              </SettingItem>

              {/* Hotkey */}
              <SettingItem icon={<Keyboard size={14} />} label={t('settings.hotkey')}>
                <code
                  className="px-2 py-1 rounded text-xs"
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {hotkey}
                </code>
              </SettingItem>

              {/* Download Path */}
              <SettingItem icon={<FolderOpen size={14} />} label={t('settings.downloadPath')}>
                <div className="flex items-center gap-2">
                  <span className="text-xs truncate max-w-[160px]" style={{ color: 'var(--color-text-secondary)' }}>
                    {downloadPath || '未设置'}
                  </span>
                  <button
                    className="px-2.5 py-1 rounded text-xs font-medium transition-all border"
                    style={{
                      color: 'var(--color-text-secondary)',
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'transparent',
                    }}
                  >
                    {t('settings.selectPath')}
                  </button>
                </div>
              </SettingItem>

              <div className="border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('settings.export')}
                </p>
                <div className="space-y-2">
                  <ExportBtn icon={<FileJson size={13} />} label={t('settings.exportJSON')} onClick={() => exportTodosJSON(todos, `todoapp-${today}.json`)} />
                  <ExportBtn icon={<FileSpreadsheet size={13} />} label={t('settings.exportCSV')} onClick={() => exportTodosCSV(todos, `todoapp-${today}.csv`)} />
                  <ExportBtn icon={<FileText size={13} />} label={t('settings.exportPDF')} onClick={() => console.log('PDF export coming soon')} />
                </div>
              </div>

              <div className="border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
                <div className="space-y-2">
                  <ExportBtn icon={<Save size={13} />} label={t('settings.backupNow')} onClick={() => exportTodosJSON(todos, `todoapp-backup-${today}.json`)} />
                  <ExportBtn icon={<Upload size={13} />} label={t('settings.import')} onClick={() => console.log('Import coming soon')} />
                </div>
              </div>

              <div className="pt-2 text-center">
                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>TodoApp v0.1.0</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── 选中态：border + 深底，不用颜色编码 ── */
function SelectBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded text-xs font-medium transition-all border"
      style={{
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
        backgroundColor: active ? 'var(--color-bg-tertiary)' : 'transparent',
        borderColor: active ? 'var(--color-text-primary)' : 'var(--color-border)',
        fontWeight: active ? 500 : 400,
      }}
    >
      {label}
    </button>
  );
}

function SettingItem({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span style={{ color: 'var(--color-text-tertiary)' }}>{icon}</span>}
        <span className="text-xs font-medium whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </span>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function ExportBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border"
      style={{
        color: 'var(--color-text-secondary)',
        borderColor: 'var(--color-border)',
        backgroundColor: 'transparent',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      {icon}
      {label}
    </button>
  );
}

import React from 'react';