import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settingsStore';
import { useTodoStore } from '../store/todoStore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderOpen, Save, Upload, FileText, FileJson, FileSpreadsheet } from 'lucide-react';
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

type PdfTemplateId = 'classic' | 'slate' | 'editorial' | 'minimal';

const PDF_TEMPLATES: {
  id: PdfTemplateId;
  labelKey: string;
  subKey: string;
  bg: string;
  barBg: string;
  isDark: boolean;
  hasLeftBorder: boolean;
  isSerif: boolean;
  hrColor: string;
}[] = [
  { id: 'classic',    labelKey: 'pdf.templateClassic',    subKey: 'pdf.templateClassicSub',    bg: '#faf9f5', barBg: '#141413', isDark: false, hasLeftBorder: false, isSerif: false, hrColor: '#e3dacc' },
  { id: 'slate',      labelKey: 'pdf.templateSlate',      subKey: 'pdf.templateSlateSub',      bg: '#141413', barBg: '#e8e6dc', isDark: true,  hasLeftBorder: false, isSerif: false, hrColor: '#2a2a28' },
  { id: 'editorial',  labelKey: 'pdf.templateEditorial',   subKey: 'pdf.templateEditorialSub',  bg: '#fffdf6', barBg: '#141413', isDark: false, hasLeftBorder: true,  isSerif: true,  hrColor: '#e3dacc' },
  { id: 'minimal',    labelKey: 'pdf.templateMinimal',     subKey: 'pdf.templateMinimalSub',    bg: '#ffffff', barBg: '#3d3d3a', isDark: false, hasLeftBorder: false, isSerif: false, hrColor: '#e3dacc' },
];

function TemplatePreview({ tmpl }: { tmpl: typeof PDF_TEMPLATES[number]; isSelected: boolean }) {
  const txtM = tmpl.isDark ? '#5e5d59' : '#87867f';
  const txtS = tmpl.isDark ? '#3d3d3a' : '#b0aea5';
  const barC = tmpl.isDark ? '#1a1a18' : '#141413';
  const lineC = tmpl.isDark ? '#2a2a28' : '#f0eee6';

  return (
    <div
      style={{
        height: '100%',
        background: tmpl.bg,
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: tmpl.hasLeftBorder ? '3px solid #141413' : 'none',
      }}
    >
      <div style={{ height: 3, background: tmpl.hrColor, marginBottom: 6, borderRadius: 2, width: '100%' }} />
      <div style={{ height: 8, background: barC, borderRadius: 2, width: '55%', marginBottom: 4 }} />
      <div style={{ height: 1, background: lineC, margin: '4px 0 5px', width: '100%' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', border: '1px solid ' + txtM, flexShrink: 0 }} />
        <div style={{ height: 3, background: txtM, borderRadius: 2, flex: 1, opacity: 0.5 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', border: '1px solid #d97757', flexShrink: 0 }} />
        <div style={{ height: 3, background: txtM, borderRadius: 2, flex: 0.65, opacity: 0.5 }} />
        <div style={{ marginLeft: 'auto', height: 3, width: 22, background: '#d97757', borderRadius: 2, opacity: 0.6 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', border: '1px solid ' + txtM, flexShrink: 0 }} />
        <div style={{ height: 3, background: txtM, borderRadius: 2, flex: 0.7, opacity: 0.4 }} />
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 4 }}>
        <div style={{ height: 1, background: lineC, width: '100%', marginBottom: 3 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ height: 2, width: 40, background: txtS, borderRadius: 1 }} />
          <div style={{ height: 2, width: 14, background: txtS, borderRadius: 1 }} />
        </div>
      </div>
    </div>
  );
}

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

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: '0.5px solid var(--color-separator)' }}>
      <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function ToggleGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex rounded overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>{children}</div>;
}

function ToggleBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className="px-2.5 py-1 text-[10px] font-medium transition-all cursor-pointer"
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
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
      style={{ color: 'var(--color-text-secondary)', backgroundColor: 'transparent' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      <span style={{ color: 'var(--color-text-tertiary)' }}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {feature && <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#E1F5EE', color: '#0F6E56' }}>{feature}</span>}
      <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>{'→'}</span>
    </button>
  );
}

export default function SettingsDrawer() {
  const { t } = useTranslation();
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
  const [selectedTemplate, setSelectedTemplate] = React.useState<PdfTemplateId>('classic');
  const [pdfNote, setPdfNote] = React.useState('');
  const [pdfTitle, setPdfTitle] = React.useState('');
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
      await exportTodosPDF(todos, lang, template, pdfNote, pdfTitle || t('pdf.titlePlaceholder'));
      show(t('settings.pdfExportSuccess'));
      setShowPdfPicker(false);
      setPdfNote('');
      setPdfTitle('');
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

  const selectedTmpl = PDF_TEMPLATES.find((tpl) => tpl.id === selectedTemplate)!;

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
          {/* Settings modal */}
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
            {/* Left nav — 150px per spec */}
            <div className="flex-shrink-0 border-r flex flex-col" style={{ width: '150px', borderColor: 'var(--color-border)' }}>
              <div className="px-4 py-3 border-b flex items-center" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)', letterSpacing: 'var(--tracking-normal)' }}>
                  {t('settings.title')}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {(['general', 'data'] as const).map((group) => (
                  <div key={group}>
                    <div className="px-4 pt-3 pb-1 text-[9px] font-medium uppercase tracking-widest select-none" style={{ color: 'var(--color-text-tertiary)' }}>
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
                            height: '28px',
                            padding: '0 10px',
                            fontSize: '11px',
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
              <div className="px-4 py-2.5 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-[9px]" style={{ color: 'var(--color-text-tertiary)' }}>v0.1.0</span>
              </div>
            </div>

            {/* Right panel */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {t(NAV_ITEMS.find((i) => i.key === activeNav)?.label ?? '')}
                </span>
                <button onClick={() => setIsOpen(false)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer" style={{ color: 'var(--color-text-tertiary)' }}>
                  <X size={13} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto" style={{ padding: '12px 16px' }}>
                {activeNav === 'appearance' && (
                  <div style={{ gap: '16px', display: 'flex', flexDirection: 'column' }}>
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
                          className="w-20 h-1 rounded-full cursor-pointer" style={{ accentColor: 'var(--clay)' }} />
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
                      className="px-3 py-1.5 rounded text-xs border transition-all min-w-[120px] text-center cursor-pointer"
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
                      <button onClick={handleSelectPath} className="px-2 py-1 rounded text-xs border cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                        <FolderOpen size={12} />
                      </button>
                    </div>
                  </SettingRow>
                )}

                {activeNav === 'export' && (
                  <div className="space-y-1">
                    <ExportRow
                      icon={<FileText size={13} />}
                      label={t('settings.exportPDF')}
                      feature="New"
                      onClick={() => {
                        setSelectedTemplate('classic');
                        setShowPdfPicker(true);
                      }}
                    />
                    <ExportRow icon={<FileJson size={13} />} label={t('settings.exportJSON')} onClick={handleExportJSON} />
                    <ExportRow icon={<FileSpreadsheet size={13} />} label={t('settings.exportCSV')} onClick={handleExportCSV} />
                    <ExportRow icon={<Save size={13} />} label={t('settings.backupNow')} onClick={handleBackup} />
                  </div>
                )}

                {activeNav === 'import' && (
                  <>
                    <ExportRow icon={<Upload size={13} />} label={t('settings.import')} onClick={handleImport} />
                    <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileSelected} />
                    <p className="text-[10px] px-1 mt-2 leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
                      {t('settings.importHint')}
                    </p>
                  </>
                )}
              </div>
            </div>
          </motion.div>

          {/* PDF Template Picker — per spec: 2x2 grid, visual previews, select + export */}
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
                className="rounded-xl p-5"
                style={{
                  width: 'min(540px, 92vw)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '0.5px solid var(--color-border)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{t('pdf.title')}</h2>
                  <button onClick={() => setShowPdfPicker(false)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer" style={{ color: 'var(--color-text-tertiary)' }}>
                    <X size={13} />
                  </button>
                </div>

                {/* 2x2 grid with visual previews */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {PDF_TEMPLATES.map((tmpl) => {
                    const isSel = selectedTemplate === tmpl.id;
                    return (
                      <button
                        key={tmpl.id}
                        onClick={() => setSelectedTemplate(tmpl.id)}
                        className="flex flex-col overflow-hidden rounded-xl border transition-all cursor-pointer text-left"
                        style={{
                          borderColor: isSel ? '#d97757' : 'var(--color-border)',
                          borderWidth: '2px',
                          backgroundColor: tmpl.bg,
                          boxShadow: isSel ? '0 0 0 1px rgba(217,119,87,0.15)' : 'none',
                        }}
                      >
                        {/* Visual preview area — 100px per spec */}
                        <div
                          style={{
                            height: '100px',
                            background: tmpl.bg,
                            borderBottom: '0.5px solid var(--color-border)',
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          <TemplatePreview tmpl={tmpl} isSelected={isSel} />
                          {isSel && (
                            <div
                              className="absolute"
                              style={{
                                top: 5,
                                right: 5,
                                background: '#d97757',
                                color: '#fff',
                                fontSize: 9,
                                fontWeight: 500,
                                padding: '2px 5px',
                                borderRadius: 3,
                                zIndex: 2,
                              }}
                            >
                              {t('pdf.selected')}
                            </div>
                          )}
                        </div>
                        {/* Info area */}
                        <div style={{ padding: '6px 10px', background: tmpl.bg }}>
                          <div className="text-xs font-medium mb-0.5" style={{ color: tmpl.isDark ? '#e8e6dc' : '#141413' }}>
                            {t(tmpl.labelKey)}
                          </div>
                          <div className="text-[10px]" style={{ color: tmpl.isDark ? '#5e5d59' : '#87867f' }}>
                            {t(tmpl.subKey)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Editable fields — note + report title per spec v2 */}
                <div className="flex flex-col gap-2 mb-3" style={{ padding: '8px 10px', borderRadius: 8, border: '0.5px dashed var(--color-border)', backgroundColor: 'var(--color-bg-primary)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-medium uppercase tracking-wider flex-shrink-0" style={{ color: '#d97757', minWidth: 48 }}>{t('pdf.noteLabel')}</span>
                    <input
                      type="text"
                      value={pdfNote}
                      onChange={(e) => setPdfNote(e.target.value)}
                      placeholder={t('pdf.notePlaceholder')}
                      className="flex-1 text-xs outline-none bg-transparent"
                      style={{ color: 'var(--color-text-secondary)' }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-medium uppercase tracking-wider flex-shrink-0" style={{ color: '#d97757', minWidth: 48 }}>{t('pdf.titleLabel')}</span>
                    <input
                      type="text"
                      value={pdfTitle}
                      onChange={(e) => setPdfTitle(e.target.value)}
                      placeholder={t('pdf.titlePlaceholder')}
                      className="flex-1 text-xs outline-none bg-transparent"
                      style={{ color: 'var(--color-text-secondary)' }}
                    />
                  </div>
                </div>

                {/* Bottom bar: selected label + actions */}
                <div className="flex items-center justify-between pt-3" style={{ borderTop: '0.5px solid var(--color-border)' }}>
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {t('pdf.selectedLabel')}
                    <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{t(selectedTmpl.labelKey)}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPdfPicker(false)}
                      className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer"
                      style={{
                        color: 'var(--color-text-secondary)',
                        backgroundColor: 'transparent',
                        border: '0.5px solid var(--color-border)',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                    >
                      {t('pdf.cancel')}
                    </button>
                    <button
                      onClick={() => handleExportPDF(selectedTemplate)}
                      className="px-4 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer"
                      style={{
                        backgroundColor: 'var(--color-fill)',
                        color: 'var(--color-fill-text)',
                        border: 'none',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--clay)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-fill)'; }}
                    >
                      {t('pdf.exportButton')} {'→'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
