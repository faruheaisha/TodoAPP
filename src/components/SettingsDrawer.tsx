import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settingsStore';
import { useTodoStore } from '../store/todoStore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderOpen, Save, Upload, FileText, FileJson, FileSpreadsheet, File, AlignLeft, LayoutGrid, List } from 'lucide-react';
import { exportTodosJSON, exportTodosCSV, downloadFile } from '../lib/csv-export';
import { useToast } from './Toast';

type NavSection = 'appearance' | 'shortcut' | 'path' | 'export' | 'import';

interface NavItem {
  key: NavSection;
  label: string;
  group: 'general' | 'data';
}

const NAV_ITEMS: NavItem[] = [
  { key: 'appearance', label: 'settings.navAppearance', group: 'general' },
  { key: 'shortcut', label: 'settings.navShortcut', group: 'general' },
  { key: 'path', label: 'settings.navPath', group: 'general' },
  { key: 'export', label: 'settings.navExport', group: 'data' },
  { key: 'import', label: 'settings.navImport', group: 'data' },
];

type PdfTemplateId = 'classic' | 'compact' | 'detailed' | 'kanban';

const PDF_TEMPLATES: { id: PdfTemplateId; icon: React.ReactNode; labelKey: string; descKey: string }[] = [
  { id: 'classic', icon: <File size={20} />, labelKey: 'pdf.templateClassic', descKey: 'pdf.templateClassicDesc' },
  { id: 'compact', icon: <AlignLeft size={20} />, labelKey: 'pdf.templateCompact', descKey: 'pdf.templateCompactDesc' },
  { id: 'detailed', icon: <List size={20} />, labelKey: 'pdf.templateDetailed', descKey: 'pdf.templateDetailedDesc' },
  { id: 'kanban', icon: <LayoutGrid size={20} />, labelKey: 'pdf.templateKanban', descKey: 'pdf.templateKanbanDesc' },
];

function eventToShortcut(e: React.KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  const key = e.key === ' ' ? 'Space' : e.key;
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return '';
  parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.join('+');
}

export default function SettingsDrawer() {
  const { t, i18n } = useTranslation();
  const {
    theme, setTheme, language, setLanguage,
    startupDelay, setStartupDelay, hotkey, setHotkey,
    downloadPath, setDownloadPath,
    isOpen, setIsOpen,
  } = useSettingsStore();
  const { todos, setTodos } = useTodoStore();
  const { show } = useToast();

  const [activeNav, setActiveNav] = React.useState<NavSection>('appearance');
  const [recording, setRecording] = React.useState(false);
  const [showPdfPicker, setShowPdfPicker] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().split('T')[0];

  const lang = language as 'zh' | 'en';

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPdfPicker) { setShowPdfPicker(false); return; }
        setIsOpen(false);
      }
    };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, showPdfPicker, setIsOpen]);

  const handleExportJSON = () => {
    exportTodosJSON(todos, 'todoapp-' + today + '.json');
    show(t('settings.exportSuccess'));
  };

  const handleExportCSV = () => {
    exportTodosCSV(todos, 'todoapp-' + today + '.csv');
    show(t('settings.exportSuccess'));
  };

  const handleBackup = () => {
    const backupData = JSON.stringify({ todos, exportedAt: new Date().toISOString() }, null, 2);
    downloadFile(backupData, 'todoapp-backup-' + today + '.json', 'application/json');
    show(t('settings.backupSuccess'));
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const raw = JSON.parse(evt.target?.result as string);
        const imported = raw.todos ?? raw;
        if (Array.isArray(imported) && imported.length > 0) {
          setTodos(imported);
          show(t('settings.importSuccess') + ' ' + imported.length + ' ' + t('app.items'));
        } else {
          show(t('settings.importInvalid'));
        }
      } catch {
        show(t('settings.importFail'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportPDF = async (template: PdfTemplateId) => {
    try {
      const { exportTodosPDF } = await import('../lib/pdf-export');
      await exportTodosPDF(todos, lang);
      show(t('settings.pdfExportSuccess'));
      setShowPdfPicker(false);
    } catch (err) {
      console.error('PDF export failed:', err);
      show(t('settings.pdfExportFail'));
    }
  };

  const handleSelectPath = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false, title: t('settings.selectPathTitle') });
      if (selected && typeof selected === 'string') {
        setDownloadPath(selected);
        show(t('settings.pathSet'));
      }
    } catch {
      const fallback = prompt(t('settings.pathPrompt'), downloadPath || '');
      if (fallback) {
        setDownloadPath(fallback);
        show(t('settings.pathSet'));
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
            onClick={() => setIsOpen(false)}
          />
          {/* Centered modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed z-50 flex overflow-hidden"
            style={{
              width: 'min(720px, 92vw)',
              maxHeight: '88vh',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '0.5px solid var(--color-border)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Left nav */}
            <div className="flex-shrink-0 border-r flex flex-col" style={{ width: '180px', borderColor: 'var(--color-border)' }}>
              <div className="px-5 py-4 border-b flex items-center" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)', letterSpacing: 'var(--tracking-normal)' }}>
                  {t('settings.title')}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto py-2">
                {(['general', 'data'] as const).map((group) => (
                  <div key={group}>
                    <div className="px-5 pt-3 pb-1 text-[10px] font-medium uppercase tracking-widest select-none" style={{ color: 'var(--color-text-tertiary)' }}>
                      {t('settings.group' + (group === 'general' ? 'General' : 'Data'))}
                    </div>
                    {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                      const isActive = activeNav === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() => setActiveNav(item.key)}
                          className="w-full text-left flex items-center gap-2 transition-all cursor-pointer"
                          style={{
                            height: '32px',
                            padding: '0 14px',
                            fontSize: '12px',
                            color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                            backgroundColor: isActive ? 'var(--color-bg-tertiary)' : 'transparent',
                            borderLeft: isActive ? '2px solid var(--clay)' : '2px solid transparent',
                            fontWeight: isActive ? 500 : 400,
                          }}
                        >
                          {t(item.label)}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>v0.1.0</span>
              </div>
            </div>

            {/* Right panel */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {t(NAV_ITEMS.find((i) => i.key === activeNav)?.label ?? '')}
                </span>
                <button onClick={() => setIsOpen(false)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer" style={{ color: 'var(--color-text-tertiary)' }}>
                  <X size={15} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto" style={{ padding: '16px 20px' }}>
                {activeNav === 'appearance' && (
                  <div style={{ gap: '20px', display: 'flex', flexDirection: 'column' }}>
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
                      <div className="flex items-center gap-2">
                        <input type="range" min={1} max={30} value={startupDelay}
                          onChange={(e) => setStartupDelay(Number(e.target.value))}
                          className="w-24 h-1 rounded-full cursor-pointer" style={{ accentColor: 'var(--clay)' }} />
                        <span className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                          {startupDelay} {t('settings.minutes')}
                        </span>
                      </div>
                    </SettingRow>
                  </div>
                )}

                {activeNav === 'shortcut' && (
                  <SettingRow label={t('settings.hotkey')}>
                    <button
                      onClick={() => setRecording(true)}
                      onKeyDown={(e) => {
                        if (!recording) return;
                        e.preventDefault();
                        e.stopPropagation();
                        const shortcut = eventToShortcut(e);
                        if (shortcut) { setHotkey(shortcut); setRecording(false); }
                      }}
                      className="px-4 py-2 rounded-md text-xs border transition-all min-w-[140px] text-center cursor-pointer"
                      style={{
                        borderColor: recording ? 'var(--clay)' : 'var(--color-border)',
                        backgroundColor: recording ? 'var(--clay-light)' : 'var(--color-bg-tertiary)',
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {recording ? t('settings.hotkeyHint') : hotkey || 'Ctrl+Shift+T'}
                    </button>
                  </SettingRow>
                )}

                {activeNav === 'path' && (
                  <SettingRow label={t('settings.downloadPath')}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs truncate max-w-[180px]" style={{ color: 'var(--color-text-secondary)' }}>
                        {downloadPath || t('settings.pathUnset')}
                      </span>
                      <button onClick={handleSelectPath} className="px-3 py-1.5 rounded-md text-xs border cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                        <FolderOpen size={13} />
                      </button>
                    </div>
                  </SettingRow>
                )}

                {activeNav === 'export' && (
                  <div className="space-y-1">
                    <ExportRow
                      icon={<FileText size={14} />}
                      label={t('settings.exportPDF')}
                      feature="New"
                      onClick={() => setShowPdfPicker(true)}
                    />
                    <ExportRow icon={<FileJson size={14} />} label={t('settings.exportJSON')} onClick={handleExportJSON} />
                    <ExportRow icon={<FileSpreadsheet size={14} />} label={t('settings.exportCSV')} onClick={handleExportCSV} />
                    <ExportRow icon={<Save size={14} />} label={t('settings.backupNow')} onClick={handleBackup} />
                  </div>
                )}

                {activeNav === 'import' && (
                  <>
                    <ExportRow icon={<Upload size={14} />} label={t('settings.import')} onClick={handleImport} />
                    <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileSelected} />
                    <p className="text-xs px-2 mt-3 leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
                      {t('settings.importHint')}
                    </p>
                  </>
                )}
              </div>
            </div>
          </motion.div>

          {/* PDF Template Picker Modal */}
          {showPdfPicker && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
              onClick={() => setShowPdfPicker(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="rounded-xl p-6"
                style={{
                  width: 'min(560px, 90vw)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '0.5px solid var(--color-border)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{t('pdf.title')}</h2>
                  <button onClick={() => setShowPdfPicker(false)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer" style={{ color: 'var(--color-text-tertiary)' }}>
                    <X size={15} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {PDF_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => handleExportPDF(tmpl.id)}
                      className="flex flex-col items-start gap-3 p-4 rounded-xl border transition-all text-left cursor-pointer"
                      style={{
                        borderColor: 'var(--color-border)',
                        backgroundColor: 'var(--color-bg-primary)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--clay)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(217,119,87,0.12)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                        {tmpl.icon}
                      </div>
                      <div>
                        <div className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>{t(tmpl.labelKey)}</div>
                        <div className="text-xs leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>{t(tmpl.descKey)}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex justify-end mt-5">
                  <button
                    onClick={() => setShowPdfPicker(false)}
                    className="px-4 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    style={{
                      color: 'var(--color-text-secondary)',
                      backgroundColor: 'var(--color-bg-tertiary)',
                      border: '0.5px solid var(--color-border)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-border)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                  >
                    {t('pdf.cancel')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: '0.5px solid var(--color-separator)' }}>
      <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function ToggleGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>{children}</div>;
}

function ToggleBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 text-xs font-medium transition-all cursor-pointer"
      style={{
        color: active ? 'var(--color-fill-text)' : 'var(--color-text-tertiary)',
        backgroundColor: active ? 'var(--color-fill)' : 'transparent',
        border: 'none',
      }}
    >
      {label}
    </button>
  );
}

function ExportRow({ icon, label, onClick, feature }: { icon: React.ReactNode; label: string; onClick: () => void; feature?: string }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
      style={{ color: 'var(--color-text-secondary)', backgroundColor: 'transparent' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      <span style={{ color: 'var(--color-text-tertiary)' }}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {feature && <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ backgroundColor: '#E1F5EE', color: '#0F6E56' }}>{feature}</span>}
      <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>{'→'}</span>
    </button>
  );
}
