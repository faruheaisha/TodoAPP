import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settingsStore';
import { useTodoStore } from '../store/todoStore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe, Moon, Sun, Keyboard, FolderOpen, Save, Upload, FileText, FileJson, FileSpreadsheet } from 'lucide-react';
import { exportTodosJSON, exportTodosCSV } from '../lib/csv-export';
import { useToast } from './Toast';

/* ── 导航项定义 ── */
type NavSection = 'general' | 'appearance' | 'shortcut' | 'path' | 'export' | 'import';

interface NavItem {
  key: NavSection;
  label: string;
  group: '通用' | '数据';
}

const NAV_ITEMS: NavItem[] = [
  { key: 'appearance', label: '外观与语言', group: '通用' },
  { key: 'shortcut', label: '快捷键', group: '通用' },
  { key: 'path', label: '存储路径', group: '通用' },
  { key: 'export', label: '导出数据', group: '数据' },
  { key: 'import', label: '导入备份', group: '数据' },
];

export default function SettingsDrawer() {
  const { t, i18n } = useTranslation();
  const {
    theme, setTheme, language, setLanguage,
    startupDelay, setStartupDelay, hotkey,
    downloadPath, setDownloadPath,
    isOpen, setIsOpen,
  } = useSettingsStore();
  const { todos } = useTodoStore();
  const { show } = useToast();

  const [activeNav, setActiveNav] = React.useState<NavSection>('appearance');
  const today = new Date().toISOString().split('T')[0];

  // Close on ESC key
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, setIsOpen]);

  const handleExportJSON = () => {
    exportTodosJSON(todos, `todoapp-${today}.json`);
    show('✓ 已保存至 Downloads');
  };

  const handleExportCSV = () => {
    exportTodosCSV(todos, `todoapp-${today}.csv`);
    show('✓ 已保存至 Downloads');
  };

  const handleBackup = () => {
    const id = show('⏳ 正在备份...', 'loading');
    setTimeout(() => {
      exportTodosJSON(todos, `todoapp-backup-${today}.json`);
      show('✓ 备份完成');
      // dismiss loading toast automatically
    }, 800);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Full modal backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 cursor-pointer"
            style={{ backgroundColor: 'var(--slate)' }}
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-[420px] z-50 border-l shadow-2xl overflow-hidden flex"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              borderColor: 'var(--color-border)',
            }}
          >
            {/* Left nav — 150px */}
            <div
              className="w-[150px] flex-shrink-0 border-r flex flex-col"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="px-4 py-3 border-b flex items-center" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)', letterSpacing: 'var(--tracking-normal)' }}>
                  {t('settings.title')}
                </span>
              </div>

              {/* Nav groups */}
              <div className="flex-1 overflow-y-auto py-1">
                {['通用', '数据'].map((group) => (
                  <div key={group}>
                    <div
                      className="px-4 pt-3 pb-1 text-[9px] font-medium uppercase tracking-widest select-none"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      {group}
                    </div>
                    {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                      const isActive = activeNav === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() => setActiveNav(item.key)}
                          className="w-full text-left px-4 py-2 text-xs transition-all flex items-center gap-2"
                          style={{
                            color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                            backgroundColor: isActive ? 'var(--color-bg-tertiary)' : 'transparent',
                            borderLeft: isActive ? '2px solid var(--clay)' : '2px solid transparent',
                            fontWeight: isActive ? 500 : 400,
                          }}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Version */}
              <div className="px-4 py-2.5 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-[9px]" style={{ color: 'var(--color-text-tertiary)' }}>v0.1.0</span>
              </div>
            </div>

            {/* Right content */}
            <div className="flex-1 overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {NAV_ITEMS.find((i) => i.key === activeNav)?.label}
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-6 h-6 rounded flex items-center justify-center"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  <X size={14} />
                </button>
              </div>

              <div className="px-4 py-4 space-y-4">
                {/* Appearance section */}
                {activeNav === 'appearance' && (
                  <>
                    <SettingRow label={t('settings.language')}>
                      <ToggleGroup>
                        <ToggleBtn active={language === 'zh'} onClick={() => setLanguage('zh')} label="中文" />
                        <ToggleBtn active={language === 'en'} onClick={() => setLanguage('en')} label="English" />
                      </ToggleGroup>
                    </SettingRow>
                    <SettingRow label={t('settings.theme')}>
                      <ToggleGroup>
                        <ToggleBtn active={theme === 'light'} onClick={() => setTheme('light')} label={t('settings.lightMode')} />
                        <ToggleBtn active={theme === 'dark'} onClick={() => setTheme('dark')} label={t('settings.darkMode')} />
                      </ToggleGroup>
                    </SettingRow>
                    <SettingRow label={t('settings.startupDelay')}>
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{startupDelay} {t('settings.minutes')}</span>
                    </SettingRow>
                  </>
                )}

                {/* Shortcut */}
                {activeNav === 'shortcut' && (
                  <SettingRow label={t('settings.hotkey')}>
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
                  </SettingRow>
                )}

                {/* Path */}
                {activeNav === 'path' && (
                  <SettingRow label={t('settings.downloadPath')}>
                    <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)', maxWidth: '160px' }}>
                      {downloadPath || '未设置'}
                    </span>
                  </SettingRow>
                )}

                {/* Export */}
                {activeNav === 'export' && (
                  <div className="space-y-1">
                    <ExportRow
                      icon={<FileText size={13} />}
                      label="导出为 PDF"
                      feature="特色"
                      onClick={() => console.log('PDF template modal')}
                    />
                    <ExportRow icon={<FileJson size={13} />} label="导出为 JSON" onClick={handleExportJSON} />
                    <ExportRow icon={<FileSpreadsheet size={13} />} label="导出为 CSV" onClick={handleExportCSV} />
                    <ExportRow icon={<Save size={13} />} label="立即备份" onClick={handleBackup} />
                  </div>
                )}

                {/* Import */}
                {activeNav === 'import' && (
                  <ExportRow icon={<Upload size={13} />} label="导入备份" onClick={() => console.log('Import')} />
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Sub-components ── */

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: '0.5px solid var(--color-bg-tertiary)' }}>
      <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function ToggleGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex rounded overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
      {children}
    </div>
  );
}

function ToggleBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 text-[10px] font-medium transition-all"
      style={{
        color: active ? 'var(--ivory-light)' : 'var(--color-text-tertiary)',
        backgroundColor: active ? 'var(--slate)' : 'transparent',
        border: 'none',
      }}
    >
      {label}
    </button>
  );
}

function ExportRow({ icon, label, onClick, feature }: { icon: React.ReactNode; label: string; onClick: () => void; feature?: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all"
      style={{
        color: 'var(--color-text-secondary)',
        backgroundColor: 'transparent',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      <span style={{ color: 'var(--color-text-tertiary)' }}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {feature && (
        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: '#E1F5EE', color: '#0F6E56' }}>{feature}</span>
      )}
      <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>→</span>
    </button>
  );
}