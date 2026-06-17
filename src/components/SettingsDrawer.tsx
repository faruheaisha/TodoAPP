import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, type AccentColor } from '../store/settingsStore';
import { useTodoStore } from '../store/todoStore';
import { useHabitStore } from '../store/habitStore';
import { useTagStore } from '../store/tagStore';
import { useSubtaskStore } from '../store/subtaskStore';
import { useCompletionStore } from '../store/completionStore';
import { useNotesStore } from '../store/notesStore';
import { useRecurrenceStore } from '../store/recurrenceStore';
import { useQuadrantStore } from '../store/quadrantStore';
import { useFocusStore } from '../store/focusStore';
import { useTimerStore } from '../store/timerStore';
import { useSoundscapeStore } from '../store/soundscapeStore';
import { useMusicLibraryStore } from '../store/musicLibraryStore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderOpen, Save, FileText, FileJson, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { todosToCSV, saveFileWithDialog } from '../lib/csv-export';
import { parseImportFile, mergeWithExisting, type ImportResult } from '../lib/import-utils';
import { localDateKey } from '../lib/utils';
import { useSheet } from '../lib/responsive';
import { useToast } from './Toast';
import AISettings from './settings/AISettings';
import AboutPage from './about/AboutPage';

type NavSection = 'appearance' | 'shortcut' | 'path' | 'ai' | 'export' | 'import' | 'backup' | 'about';

// ── Design atoms ──

function Segmented<T extends string>({ value, onChange, options, size = 'sm' }: {
  value: T; onChange: (v: T) => void;
  options: { k: T; label: string }[]; size?: 'sm' | 'md';
}) {
  return (
    <div style={{ display: 'inline-flex', borderRadius: 8, background: 'var(--color-bg-tertiary)', padding: 2 }}>
      {options.map(opt => {
        const active = value === opt.k;
        return (
          <button key={opt.k} onClick={() => onChange(opt.k)}
            style={{
              padding: size === 'sm' ? '5px 12px' : '7px 16px',
              borderRadius: 6, fontSize: 12.5,
              fontWeight: active ? 500 : 400,
              background: active ? 'var(--color-bg-secondary)' : 'transparent',
              color: active ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              border: 'none', cursor: 'pointer',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              transition: 'background .14s, color .14s',
              lineHeight: 1.3,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)}
      style={{
        width: 40, height: 23, borderRadius: 12, flexShrink: 0,
        background: on ? 'var(--clay)' : 'var(--color-separator)',
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background .2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 19 : 2,
        width: 19, height: 19, borderRadius: '50%',
        background: '#fff', transition: 'left .2s',
        boxShadow: '0 1px 3px rgba(0,0,0,.15)',
      }} />
    </button>
  );
}

function SettingRow({ label, desc, children, last }: {
  label: string; desc?: string; children: React.ReactNode; last?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
      padding: '15px 0',
      borderBottom: last ? 'none' : '0.5px solid var(--color-separator)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500 }}>{label}</div>
        {desc && (
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 3, lineHeight: 1.5 }}>
            {desc}
          </div>
        )}
      </div>
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function GroupTitle({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase',
      color: 'var(--clay)', opacity: 0.8,
      margin: first ? '0 0 4px' : '24px 0 4px',
    }}>
      {children}
    </div>
  );
}

// ── Nav structure ──

interface NavItem { key: NavSection; labelKey: string; icon: React.ReactNode; }

/* ai-suite 1:1 SVG icons */
function SvgIc({ d, s = 16 }: { d: React.ReactNode; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}
const Icons = {
  sliders: (p?: number) => (
    <svg width={p||16} height={p||16} viewBox="0 0 1024 1024" fill="none" stroke="currentColor" strokeWidth="59" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', display: 'block' }}>
      <path d="M904.533 422.4l-85.333-14.933-17.067-38.4 49.067-70.4c14.933-21.333 12.8-49.067-6.4-68.267l-53.333-53.333c-19.2-19.2-46.933-21.334-68.267-6.4l-70.4 49.066-38.4-17.066-14.933-85.334c-2.134-23.466-23.467-42.666-49.067-42.666h-74.667c-25.6 0-46.933 19.2-53.333 44.8l-14.933 85.333-38.4 17.067L296.533 170.667c-21.333-14.934-49.067-12.8-68.266 6.4l-53.334 53.333c-19.2 19.2-21.333 46.933-6.4 68.267l49.067 70.4-17.067 38.4-85.333 14.933c-21.334 4.267-40.534 25.6-40.534 51.2v74.667c0 25.6 19.2 46.933 44.8 53.333l85.333 14.933 17.067 38.4L170.667 727.467c-14.933 21.333-12.8 49.067 6.4 68.266l53.333 53.334c19.2 19.2 46.933 21.333 68.267 6.4l70.4-49.067 38.4 17.067 14.933 85.333c4.267 25.6 25.6 44.8 53.333 44.8h74.667c25.6 0 46.933-19.2 53.333-44.8l14.934-85.333 38.4-17.067 70.4 49.067c21.333 14.933 49.067 12.8 68.266-6.4l53.334-53.334c19.2-19.2 21.333-46.933 6.4-68.266l-49.067-70.4 17.067-38.4 85.333-14.934c25.6-4.266 44.8-25.6 44.8-53.333v-74.667c-4.267-27.733-23.467-49.066-49.067-53.333z"/>
      <circle cx="512" cy="512" r="117.333"/>
    </svg>
  ),
  key: (p?: number) => <SvgIc s={p} d={<><circle cx="8" cy="14" r="4" /><path d="M11 11l8-8 2 2-2 2 2 2-3 3-2-2-2 2" /></>} />,
  note: (p?: number) => <SvgIc s={p} d={<><path d="M5 3h10l4 4v14H5z" /><path d="M15 3v4h4" /></>} />,
  paw: (p?: number) => <SvgIc s={p} d={<><circle cx="7" cy="9" r="1.6" /><circle cx="12" cy="7" r="1.6" /><circle cx="17" cy="9" r="1.6" /><path d="M12 12c-3 0-5 2.5-5 4.5S9 19 12 19s5-.5 5-2.5-2-4.5-5-4.5z" /></>} />,
  ext: (p?: number) => <SvgIc s={p} d={<><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 14v5H5V6h5" /></>} />,
  cloud: (p?: number) => <SvgIc s={p} d={<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 18 18z" />} />,
  chat: (p?: number) => <SvgIc s={p} d={<path d="M4 5h16v11H9l-4 3v-3H4z" />} />,
};

const NAV_GROUPS: { groupKey: string; items: NavItem[] }[] = [
  { groupKey: 'settings.groupGeneral', items: [
    { key: 'appearance', labelKey: 'settings.navAppearance', icon: Icons.sliders() },
    { key: 'shortcut', labelKey: 'settings.navShortcut', icon: Icons.key() },
    { key: 'path', labelKey: 'settings.navPath', icon: Icons.note() },
  ]},
  { groupKey: 'settings.groupAI', items: [
    { key: 'ai', labelKey: 'settings.navAI', icon: Icons.paw() },
  ]},
  { groupKey: 'settings.groupData', items: [
    { key: 'export', labelKey: 'settings.navExport', icon: Icons.ext() },
    { key: 'backup', labelKey: 'settings.backup', icon: Icons.cloud() },
    { key: 'import', labelKey: 'settings.navImport', icon: <Save size={16} /> },
  ]},
  { groupKey: 'settings.groupAbout', items: [
    { key: 'about', labelKey: 'settings.navAbout', icon: Icons.chat() },
  ]},
];

const PANE_TITLE: Record<NavSection, string> = {
  appearance: 'settings.navAppearance',
  shortcut: 'settings.navShortcut',
  path: 'settings.navPath',
  ai: 'settings.navAI',
  export: 'settings.navExport',
  import: 'settings.navImport',
  backup: 'settings.backup',
  about: 'settings.navAbout',
};

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

function TemplatePreview({ tmpl }: { tmpl: typeof PDF_TEMPLATES[number] }) {
  const txtM = tmpl.isDark ? '#5e5d59' : '#87867f';
  const txtS = tmpl.isDark ? '#3d3d3a' : '#b0aea5';
  const barC = tmpl.isDark ? '#1a1a18' : '#141413';
  const lineC = tmpl.isDark ? '#2a2a28' : '#f0eee6';

  return (
    <div style={{
      height: '100%', background: tmpl.bg, padding: '8px 10px',
      display: 'flex', flexDirection: 'column',
      borderLeft: tmpl.hasLeftBorder ? '3px solid #141413' : 'none',
    }}>
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
    accentColor, setAccentColor,
    startupDelay, setStartupDelay, hotkey, setHotkey,
    downloadPath, setDownloadPath,
    isOpen, setIsOpen, aboutOpen, setAboutOpen,
    achievementTime, setAchievementTime,
    weeklyReportEnabled, weeklyReportDay, weeklyReportTime,
    setWeeklyReportEnabled, setWeeklyReportDay, setWeeklyReportTime,
    startupReminder, setStartupReminder,
    cloudBackupUrl, cloudBackupUser, cloudBackupPass, lastBackupAt,
    setCloudBackupUrl, setCloudBackupUser, setCloudBackupPass, setLastBackupAt,
  } = useSettingsStore();
  const { todos } = useTodoStore();
  const { show } = useToast();
  const sheet = useSheet();

  const [activeNav, setActiveNav] = React.useState<NavSection>('appearance');

  React.useEffect(() => {
    const handler = (e: Event) => {
      const nav = (e as CustomEvent).detail as NavSection;
      if (nav) setActiveNav(nav);
    };
    window.addEventListener('open-settings-nav', handler);
    return () => window.removeEventListener('open-settings-nav', handler);
  }, []);

  const [showPdfPicker, setShowPdfPicker] = React.useState(false);
  const [selectedTemplate, setSelectedTemplate] = React.useState<PdfTemplateId>('classic');
  const [pdfNote, setPdfNote] = React.useState('');
  const [pdfTitle, setPdfTitle] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const today = localDateKey();

  // Import preview state
  const [importPreview, setImportPreview] = React.useState<ImportResult & { filename: string } | null>(null);
  const [importMode, setImportMode] = React.useState<'merge' | 'replace'>('merge');
  const [importConfirmReplace, setImportConfirmReplace] = React.useState(false);
  const [importLoading, setImportLoading] = React.useState(false);

  const lang = language as 'zh' | 'en';
  const importPreviewMerge = React.useMemo(() => {
    if (!importPreview) return { toAdd: [], skipCount: 0 };
    const isForeign = importPreview.format === 'csv-external' || importPreview.format === 'json-external';
    return mergeWithExisting(importPreview.toAdd, todos, isForeign);
  }, [importPreview, todos]);

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

  const handleExportJSON = async () => {
    const json = JSON.stringify(todos, null, 2);
    const result = await saveFileWithDialog(json, 'todoapp-' + today + '.json', 'application/json', downloadPath);
    if (result === 'saved') { show(t('settings.exportSuccess')); }
    else if (result === 'cancelled') { show(t('settings.exportCancelled'), 'warning'); }
    else { show(t('settings.exportFailed'), 'warning'); }
  };

  const handleExportCSV = async () => {
    const csv = todosToCSV(todos);
    const result = await saveFileWithDialog(csv, 'todoapp-' + today + '.csv', 'text/csv', downloadPath);
    if (result === 'saved') { show(t('settings.exportSuccess')); }
    else if (result === 'cancelled') { show(t('settings.exportCancelled'), 'warning'); }
    else { show(t('settings.exportFailed'), 'warning'); }
  };

  const handleImport = (_format: 'json' | 'csv') => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string || '';
        const result = parseImportFile(content, file.name);
        if (!result || result.toAdd.length === 0) {
          show(t('settings.importInvalid'));
        } else {
          setImportPreview({ ...result, filename: file.name });
          setImportMode('merge');
          setImportConfirmReplace(false);
        }
      } catch {
        show(t('settings.importFail'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    setImportLoading(true);
    try {
      const { todos: existing } = useTodoStore.getState();
      const isForeign = importPreview.format === 'csv-external' || importPreview.format === 'json-external';
      const { toAdd, skipCount } = mergeWithExisting(importPreview.toAdd, existing, isForeign);

      if (importMode === 'replace') {
        await useTodoStore.getState().deleteAllTodos();
        if (importPreview.format === 'json-full' && importPreview.fullBackup) {
          const raw = importPreview.fullBackup;
          if (raw.habits) useHabitStore.setState({ habits: raw.habits as any });
          if (raw.tags) useTagStore.setState({ tags: raw.tags as any, todoTags: (raw.todoTags ?? {}) as any });
          if (raw.subtasks) useSubtaskStore.setState({ subtasks: raw.subtasks as any });
          if (raw.completionTimes) useCompletionStore.setState({ completionTimes: raw.completionTimes as any });
          if (raw.notes) useNotesStore.setState({ scratchpad: (raw.notes as any).scratchpad ?? '', todoNotes: (raw.notes as any).todoNotes ?? {} });
          if (raw.recurrence) useRecurrenceStore.setState({ rules: raw.recurrence as any });
          if (raw.quadrant) useQuadrantStore.setState({ overrides: raw.quadrant as any });
          if (raw.focusSessions) useFocusStore.setState({ sessionLog: raw.focusSessions as any });
          if (raw.timers) useTimerStore.setState({ timers: (raw.timers as any[]).map((t: any) => ({ ...t, anchorTs: null })) });
          if ((raw.soundscape as any)?.volumes) useSoundscapeStore.setState({ volumes: (raw.soundscape as any).volumes, masterVolume: (raw.soundscape as any).masterVolume ?? 0.7 });
          if (raw.musicLibrary) {
            useMusicLibraryStore.setState({
              tracks: (raw.musicLibrary as any).tracks ?? [],
              categories: (raw.musicLibrary as any).categories ?? [],
              volumes: (raw.musicLibrary as any).volumes ?? {},
              masterVolume: (raw.musicLibrary as any).masterVolume ?? 0.7,
            });
          }
        }
        await useTodoStore.getState().bulkImportTodos(importPreview.toAdd);
        show(`${t('settings.importSuccess')} ${importPreview.toAdd.length} ${t('app.items')}`);
      } else {
        if (toAdd.length === 0) {
          show(lang === 'zh' ? `已跳过 ${skipCount} 条重复项，无新数据` : `All ${skipCount} already exist — nothing added`, 'warning');
        } else {
          await useTodoStore.getState().bulkImportTodos(toAdd);
          const msg = lang === 'zh'
            ? `已导入 ${toAdd.length} 条，跳过 ${skipCount} 条重复`
            : `Imported ${toAdd.length}, skipped ${skipCount} duplicates`;
          show(msg);
        }
      }
    } catch {
      show(t('settings.importFail'));
    } finally {
      setImportLoading(false);
      setImportPreview(null);
      setImportConfirmReplace(false);
    }
  };

  const handleExportPDF = async (template: PdfTemplateId) => {
    try {
      const { exportTodosPDF } = await import('../lib/pdf-export');
      await exportTodosPDF(todos, lang, template, pdfNote, pdfTitle || t('pdf.titlePlaceholder'), '', downloadPath);
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

  const openAboutPage = () => {
    setAboutOpen(true);
    setIsOpen(false);
  };

  const handleNavSelect = (key: NavSection) => {
    if (key === 'about') {
      openAboutPage();
      return;
    }
    setActiveNav(key);
  };

  const flatNavItems = NAV_GROUPS.flatMap(g => g.items);

  const ACCENTS: { key: AccentColor; color: string }[] = [
    { key: 'coral', color: '#d97757' },
    { key: 'olive', color: '#788c5d' },
    { key: 'sky',   color: '#6a9bcc' },
    { key: 'fig',   color: '#c46686' },
  ];

  const closeBtn = (
    <button onClick={() => setIsOpen(false)}
      className="w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer"
      style={{ color: 'var(--color-text-tertiary)', background: 'none', border: 'none', padding: 0 }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      <X size={17} />
    </button>
  );

  return (
    <>
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

          {/* Panel */}
          <div className={`fixed inset-0 z-50 flex justify-center pointer-events-none ${sheet.alignClass}`}>
          <motion.div
            {...sheet.motion}
            className={`${sheet.isPhone ? 'flex-col' : ''} flex overflow-hidden pointer-events-auto`}
            style={{
              ...sheet.panelStyle({ width: 'min(820px, 94vw)', height: 'min(600px, 90vh)' }),
              ...(sheet.isPhone ? { height: 'min(85dvh, 640px)' } : null),
              backgroundColor: 'var(--color-bg-secondary)',
              border: '0.5px solid var(--color-border)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {sheet.isPhone ? (
              <>
                <div className="flex-shrink-0 border-b flex items-center overflow-x-auto" style={{ borderColor: 'var(--color-border)', padding: '8px 12px', gap: '6px' }}>
                  {flatNavItems.map((item) => {
                    const isActive = activeNav === item.key;
                    return (
                      <button key={item.key} onClick={() => handleNavSelect(item.key)}
                        className="flex-shrink-0 transition-all cursor-pointer rounded-lg"
                        style={{
                          height: '38px', padding: '0 14px', fontSize: '13px',
                          whiteSpace: 'nowrap',
                          color: isActive ? 'var(--color-fill-text)' : 'var(--color-text-tertiary)',
                          backgroundColor: isActive ? 'var(--color-fill)' : 'var(--color-bg-tertiary)',
                          fontWeight: isActive ? 500 : 400,
                          border: 'none',
                        }}
                      >
                        {t(item.labelKey)}
                      </button>
                    );
                  })}
                </div>
                <div className="flex-1 overflow-y-auto" style={{ padding: '20px 18px' }}>
                  {renderContent(activeNav)}
                </div>
              </>
            ) : (
              <>
                {/* Left nav — 168px Raycast-style */}
                <nav style={{
                  width: 168, flex: '0 0 168px',
                  borderRight: '0.5px solid var(--color-border)',
                  padding: '16px 12px', overflowY: 'auto',
                  background: 'var(--color-bg-primary)',
                  display: 'flex', flexDirection: 'column',
                }}>
                  <div style={{ fontSize: 15, fontWeight: 600, padding: '0 8px 12px', color: 'var(--color-text-primary)' }}>
                    {t('settings.title')}
                  </div>
                  {NAV_GROUPS.map((g, gi) => (
                    <div key={g.groupKey} style={{ marginTop: gi ? 14 : 0 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: 1,
                        textTransform: 'uppercase',
                        color: 'var(--clay)', opacity: 0.8, padding: '0 8px 6px',
                      }}>
                        {t(g.groupKey)}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {g.items.map(it => {
                          const on = activeNav === it.key;
                          return (
                            <button key={it.key} onClick={() => handleNavSelect(it.key)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 9,
                                padding: '8px 10px', borderRadius: 8,
                                border: 'none', cursor: 'pointer',
                                font: 'inherit', fontSize: 13, textAlign: 'left',
                                fontWeight: on ? 600 : 500,
                                background: on ? 'var(--color-fill)' : 'transparent',
                                color: on ? 'var(--color-fill-text)' : 'var(--color-text-secondary)',
                                transition: 'background .14s',
                              }}
                              onMouseEnter={e => { if (!on) (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-tertiary)'; }}
                              onMouseLeave={e => { if (!on) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            >
                              <span style={{ opacity: on ? 1 : 0.7 }}>{it.icon}</span>
                              {t(it.labelKey)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 'auto', fontSize: 11, color: 'var(--color-text-tertiary)', padding: '12px 8px 2px' }}>
                    v0.1.0
                  </div>
                </nav>

                {/* Right content */}
                <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 24px',
                    borderBottom: '0.5px solid var(--color-border)',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {t(PANE_TITLE[activeNav])}
                    </span>
                    {closeBtn}
                  </div>
                  <div style={{
                    flex: 1, overflowY: 'auto',
                    padding: '8px 24px 32px', maxWidth: 640,
                  }}>
                    {renderContent(activeNav)}
                  </div>
                </main>
              </>
            )}
          </motion.div>
          </div>

          {/* PDF Template Picker */}
          {showPdfPicker && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ backgroundColor: 'rgba(217,119,87,0.25)', padding: '32px' }}
              onClick={() => setShowPdfPicker(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 0.95 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="rounded-xl pdf-picker-scroll"
                style={{
                  width: 'min(640px, 92vw)', maxHeight: '86vh', overflowY: 'auto',
                  padding: '28px', backgroundColor: 'var(--color-bg-secondary)',
                  border: '0.5px solid var(--color-border)', boxShadow: 'var(--shadow-lg)',
                  scrollbarWidth: 'thin', scrollbarColor: 'transparent transparent',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
                  <h2 className="text-sm font-semibold" style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>{t('pdf.title')}</h2>
                  <button onClick={() => setShowPdfPicker(false)}
                    className="w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer"
                    style={{ color: 'var(--color-text-tertiary)', background: 'none', border: 'none', padding: 0 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <X size={13} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-5" style={{ marginBottom: '20px' }}>
                  {PDF_TEMPLATES.map((tmpl) => {
                    const isSel = selectedTemplate === tmpl.id;
                    return (
                      <button key={tmpl.id} onClick={() => setSelectedTemplate(tmpl.id)}
                        className="flex flex-col overflow-hidden rounded-xl border transition-all cursor-pointer text-left"
                        style={{
                          borderColor: isSel ? '#d97757' : 'var(--color-border)',
                          borderWidth: '2px', backgroundColor: tmpl.bg,
                          boxShadow: isSel ? '0 0 0 1px rgba(217,119,87,0.15)' : 'none',
                        }}
                      >
                        <div style={{ height: 120, background: tmpl.bg, borderBottom: '0.5px solid var(--color-border)', position: 'relative', overflow: 'hidden' }}>
                          <TemplatePreview tmpl={tmpl} />
                          {isSel && (
                            <div className="absolute" style={{ top: 6, right: 6, background: '#d97757', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, zIndex: 2 }}>
                              {t('pdf.selected')}
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '8px 12px', background: tmpl.bg }}>
                          <div className="font-medium mb-0.5" style={{ fontSize: 13, color: tmpl.isDark ? '#e8e6dc' : '#141413' }}>{t(tmpl.labelKey)}</div>
                          <div className="text-xs" style={{ color: tmpl.isDark ? '#5e5d59' : '#87867f' }}>{t(tmpl.subKey)}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-3" style={{ marginBottom: '20px', padding: '14px 16px', borderRadius: 10, border: '0.5px dashed var(--color-border)', background: 'var(--color-bg-primary)' }}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium uppercase tracking-wider flex-shrink-0" style={{ fontSize: 11, color: '#d97757', minWidth: 52 }}>{t('pdf.noteLabel')}</span>
                    <input type="text" value={pdfNote} onChange={(e) => setPdfNote(e.target.value)} placeholder={t('pdf.notePlaceholder')} className="flex-1 outline-none bg-transparent" style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium uppercase tracking-wider flex-shrink-0" style={{ fontSize: 11, color: '#d97757', minWidth: 52 }}>{t('pdf.titleLabel')}</span>
                    <input type="text" value={pdfTitle} onChange={(e) => setPdfTitle(e.target.value)} placeholder={t('pdf.titlePlaceholder')} className="flex-1 outline-none bg-transparent" style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }} />
                  </div>
                </div>

                <div className="flex items-center justify-between" style={{ paddingTop: '16px', borderTop: '0.5px solid var(--color-border)' }}>
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {t('pdf.selectedLabel')}<span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{t(selectedTmpl.labelKey)}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowPdfPicker(false)}
                      className="rounded-md text-xs font-medium transition-colors cursor-pointer"
                      style={{ padding: '7px 18px', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)', backgroundColor: 'transparent', border: '0.5px solid var(--color-border)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                    >
                      {t('pdf.cancel')}
                    </button>
                    <button onClick={() => handleExportPDF(selectedTemplate)}
                      className="rounded-md text-xs font-medium transition-colors cursor-pointer"
                      style={{ padding: '7px 18px', whiteSpace: 'nowrap', backgroundColor: 'var(--color-fill)', color: 'var(--color-fill-text)', border: 'none' }}
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
    <AnimatePresence>
      {aboutOpen && <AboutPage onClose={() => setAboutOpen(false)} onBackToSettings={() => { setAboutOpen(false); setIsOpen(true); }} />}
    </AnimatePresence>
    {/* Import Preview Modal */}
    <AnimatePresence>
      {importPreview && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 80,
            background: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={() => !importLoading && setImportPreview(null)}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            style={{
              width: 'min(440px, 100%)', borderRadius: 18, padding: 24,
              background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {lang === 'zh' ? '导入预览' : 'Import Preview'}
              </div>
              <button onClick={() => setImportPreview(null)} disabled={importLoading}
                style={{ width: 26, height: 26, borderRadius: 8, border: '0.5px solid var(--color-border)', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)' }}
              ><X size={13} /></button>
            </div>

            {/* File info */}
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--color-bg-tertiary)', marginBottom: 14, fontSize: 11, color: 'var(--color-text-secondary)' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{importPreview.filename}</span>
              <span style={{ marginLeft: 8, padding: '2px 7px', borderRadius: 99, background: 'var(--clay-light)', color: 'var(--clay)', fontWeight: 700, fontSize: 10 }}>
                {importPreview.format.replace('-', ' ')}
              </span>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--color-bg-tertiary)', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--clay)', lineHeight: 1 }}>
                  {importMode === 'merge' ? importPreviewMerge.toAdd.length : importPreview.toAdd.length}
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 3 }}>{lang === 'zh' ? '将新增条目' : 'items to add'}</div>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--color-bg-tertiary)', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: importPreviewMerge.skipCount > 0 ? 'var(--fig)' : 'var(--olive)', lineHeight: 1 }}>
                  {importMode === 'merge' ? importPreviewMerge.skipCount : 0}
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 3 }}>{lang === 'zh' ? '重复跳过' : 'duplicates skipped'}</div>
              </div>
            </div>

            {importPreview.mappedFields.length > 0 && (
              <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 10, background: 'var(--color-bg-tertiary)', fontSize: 10, lineHeight: 1.9, color: 'var(--color-text-secondary)' }}>
                <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>{lang === 'zh' ? '字段映射' : 'Field mapping'}:</div>
                {[...new Set(importPreview.mappedFields)].slice(0, 6).map((m) => (
                  <div key={m} style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{m}</div>
                ))}
                {importPreview.mappedFields.length > 6 && (
                  <div style={{ color: 'var(--color-text-tertiary)' }}>+{importPreview.mappedFields.length - 6} more</div>
                )}
              </div>
            )}

            {/* Mode selector */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>
                {lang === 'zh' ? '导入模式' : 'Import mode'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  onClick={() => { setImportMode('merge'); setImportConfirmReplace(false); }}
                  style={{
                    padding: '10px 12px', borderRadius: 10, border: importMode === 'merge' ? '1.5px solid var(--clay)' : '0.5px solid var(--color-border)',
                    background: importMode === 'merge' ? 'var(--clay-light)' : 'var(--color-bg-tertiary)', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: importMode === 'merge' ? 'var(--clay)' : 'var(--color-text-primary)' }}>
                    {lang === 'zh' ? '追加合并' : 'Merge'}
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                    {lang === 'zh' ? '保留现有，添加新条目' : 'Keep existing, add new'}
                  </div>
                </button>
                <button
                  onClick={() => setImportMode('replace')}
                  style={{
                    padding: '10px 12px', borderRadius: 10, border: importMode === 'replace' ? '1.5px solid #c46686' : '0.5px solid var(--color-border)',
                    background: importMode === 'replace' ? 'rgba(196,102,134,0.1)' : 'var(--color-bg-tertiary)', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: importMode === 'replace' ? '#c46686' : 'var(--color-text-primary)' }}>
                    {lang === 'zh' ? '全量替换' : 'Replace all'}
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                    {lang === 'zh' ? '清空现有数据再导入' : 'Clear existing data first'}
                  </div>
                </button>
              </div>
            </div>

            {/* Replace confirmation */}
            {importMode === 'replace' && (
              <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, background: 'rgba(196,102,134,0.08)', border: '0.5px solid rgba(196,102,134,0.3)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <AlertTriangle size={14} style={{ color: '#c46686', flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: '#c46686', fontWeight: 600, marginBottom: 4 }}>
                    {lang === 'zh' ? '此操作不可撤销' : 'This action cannot be undone'}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    <input type="checkbox" checked={importConfirmReplace} onChange={(e) => setImportConfirmReplace(e.target.checked)}
                      style={{ accentColor: '#c46686' }} />
                    {lang === 'zh' ? '我了解当前所有数据将被删除' : 'I understand all current data will be deleted'}
                  </label>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setImportPreview(null)} disabled={importLoading}
                style={{ padding: '8px 16px', borderRadius: 9, border: '0.5px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}
              >
                {lang === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importLoading || (importMode === 'replace' && !importConfirmReplace)}
                style={{
                  padding: '8px 18px', borderRadius: 9, border: 'none',
                  background: importMode === 'replace' ? '#c46686' : 'var(--clay)',
                  color: '#fff', cursor: (importLoading || (importMode === 'replace' && !importConfirmReplace)) ? 'not-allowed' : 'pointer',
                  fontSize: 12, fontWeight: 700,
                  opacity: (importMode === 'replace' && !importConfirmReplace) ? 0.45 : 1,
                }}
              >
                {importLoading
                  ? (lang === 'zh' ? '导入中…' : 'Importing…')
                  : (lang === 'zh' ? '确认导入' : 'Confirm Import')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );

  function UploadIcon({ size = 15 }: { size?: number }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
      </svg>
    );
  }

  function BackupPanel() {
    const [showConfig, setShowConfig] = useState(!cloudBackupUrl);
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'done' | 'fail'>('idle');
    const [backingUp, setBackingUp] = useState(false);

    const handleSave = async () => {
      setTestStatus('testing');
      const { testWebDAVConnection, uploadBackupWebDAV } = await import('../lib/cloudBackup');
      const test = await testWebDAVConnection(cloudBackupUrl, cloudBackupUser, cloudBackupPass);
      if (!test.success) {
        setTestStatus('fail');
        return;
      }
      setTestStatus('done');
      const result = await uploadBackupWebDAV(cloudBackupUrl, cloudBackupUser, cloudBackupPass);
      if (result.success) {
        setLastBackupAt(new Date().toISOString());
        show(t('settings.backupSuccess'));
        setShowConfig(false);
      } else {
        show(result.error);
      }
    };

    const handleBackupOneClick = async () => {
      setBackingUp(true);
      const { uploadBackupWebDAV } = await import('../lib/cloudBackup');
      const result = await uploadBackupWebDAV(cloudBackupUrl, cloudBackupUser, cloudBackupPass);
      if (result.success) {
        setLastBackupAt(new Date().toISOString());
        show(t('settings.backupSuccess'));
      } else {
        show(result.error);
      }
      setBackingUp(false);
    };

    return (
      <div className="flex flex-col" style={{ gap: 16 }}>
        {/* Already configured — show one-click button + modify option */}
        {!showConfig && (
          <>
            <div style={{ background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 12, padding: '16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--olive-light, #e8f0e0)', display: 'grid', placeItems: 'center', color: 'var(--olive)' }}>
                  <UploadIcon />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>{cloudBackupUrl}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
                    {t('settings.backupLastAt')}: {lastBackupAt ? new Date(lastBackupAt).toLocaleString() : t('settings.backupNever')}
                  </div>
                </div>
              </div>
              <button onClick={handleBackupOneClick} disabled={backingUp}
                style={{
                  width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', cursor: backingUp ? 'default' : 'pointer',
                  background: 'var(--clay)', color: '#fff', fontSize: 12, fontWeight: 500,
                  opacity: backingUp ? 0.6 : 1, transition: 'opacity .15s',
                }}
              >
                {backingUp ? (lang === 'zh' ? '备份中…' : 'Backing up…') : t('settings.backupNow')}
              </button>
            </div>
            <button onClick={() => { setShowConfig(true); setTestStatus('idle'); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'left', padding: '4px 0' }}
            >
              {t('settings.backupModify')} →
            </button>
          </>
        )}

        {showConfig && (
          <div style={{ background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 12, padding: '16px 14px' }}>
            <div className="flex flex-col" style={{ gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>{t('settings.backupUrl')}</label>
                <input type="url" value={cloudBackupUrl} onChange={(e) => setCloudBackupUrl(e.target.value)}
                  placeholder="https://example.com/remote.php/dav/files/user/todoapp"
                  style={{
                    width: '100%', fontSize: 11.5, border: '0.5px solid var(--color-border)', borderRadius: 8,
                    padding: '7px 10px', background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)',
                    outline: 'none', fontFamily: 'var(--font-mono)',
                  }} />
              </div>
              <div className="flex items-center" style={{ gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>{t('settings.backupUser')}</label>
                  <input type="text" value={cloudBackupUser} onChange={(e) => setCloudBackupUser(e.target.value)}
                    style={{
                      width: '100%', fontSize: 11.5, border: '0.5px solid var(--color-border)', borderRadius: 8,
                      padding: '7px 10px', background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)',
                      outline: 'none',
                    }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>{t('settings.backupPass')}</label>
                  <input type="password" value={cloudBackupPass} onChange={(e) => setCloudBackupPass(e.target.value)}
                    style={{
                      width: '100%', fontSize: 11.5, border: '0.5px solid var(--color-border)', borderRadius: 8,
                      padding: '7px 10px', background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)',
                      outline: 'none',
                    }} />
                </div>
              </div>
              {testStatus === 'fail' && (
                <div style={{ fontSize: 11, color: 'var(--fig)' }}>{t('settings.backupTestFail')}</div>
              )}
              <button onClick={handleSave} disabled={testStatus === 'testing'}
                style={{
                  width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', cursor: testStatus === 'testing' ? 'default' : 'pointer',
                  background: 'var(--clay)', color: '#fff', fontSize: 12, fontWeight: 500,
                  opacity: testStatus === 'testing' ? 0.6 : 1,
                }}
              >
                {testStatus === 'testing' ? t('settings.backupTesting') : t('settings.backupSave')}
              </button>
            </div>
          </div>
        )}

          <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textAlign: 'center', lineHeight: 1.6 }}>
            {lang === 'zh' ? '数据通过 WebDAV 协议加密传输，仅保存在你指定的云存储中' : 'Data is transferred via WebDAV and stored only in your cloud storage'}
          </div>
        </div>
      );
    }

  function renderContent(activeNav: NavSection) {
    switch (activeNav) {
      case 'appearance':
        return (
          <div>
            <GroupTitle first>{lang === 'zh' ? '常规' : 'General'}</GroupTitle>
            <SettingRow label={t('settings.language')}>
              <Segmented value={language} onChange={setLanguage}
                options={[{ k: 'zh', label: '中文' }, { k: 'en', label: 'English' }]} />
            </SettingRow>
            <SettingRow label={t('settings.theme')}>
              <Segmented value={theme} onChange={setTheme}
                options={[
                  { k: 'light', label: lang === 'zh' ? '日间模式' : 'Light' },
                  { k: 'dark',  label: lang === 'zh' ? '夜间模式' : 'Dark' },
                  { k: 'system', label: lang === 'zh' ? '跟随系统' : 'System' },
                ]} />
            </SettingRow>
            <SettingRow label={lang === 'zh' ? '主题色' : 'Accent Color'} last>
              <div style={{ display: 'flex', gap: 6 }}>
                {ACCENTS.map(({ key, color }) => {
                  const active = (accentColor ?? 'coral') === key;
                  return (
                    <button key={key} onClick={() => setAccentColor(key)} title={key}
                      style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: color, border: active ? `2px solid var(--fg, #1A1814)` : '2px solid transparent',
                        cursor: 'pointer', position: 'relative',
                        transition: 'border-color .1s',
                      }}
                    >
                      {active && (
                        <span style={{
                          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                          fontSize: 10, fontWeight: 700, color: '#fff',
                        }}>✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </SettingRow>

            <GroupTitle>{lang === 'zh' ? '提醒' : 'Reminders'}</GroupTitle>
            <SettingRow label={t('settings.startupDelay')}
              desc={lang === 'zh' ? '启动后延迟多久弹出今日待办' : 'Delay before showing today\'s todos on startup'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => setStartupDelay(Math.max(1, startupDelay - 1))}
                  style={{
                    width: 28, height: 28, background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 6,
                    display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 14,
                    transition: 'background .15s, color .15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-border)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-secondary)'; }}
                >−</button>
                <span style={{
                  fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)',
                  minWidth: 28, textAlign: 'center', fontWeight: 500,
                }}>{startupDelay}</span>
                <span style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', marginLeft: -8, marginRight: 10 }}>
                  {t('settings.minutes')}
                </span>
                <button onClick={() => setStartupDelay(Math.min(10, startupDelay + 1))}
                  style={{
                    width: 28, height: 28, background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 6,
                    display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 14,
                    transition: 'background .15s, color .15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-border)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-secondary)'; }}
                >+</button>
              </div>
            </SettingRow>
            <SettingRow label={t('settings.startupReminder')} last>
              <Switch on={startupReminder} onChange={setStartupReminder} />
            </SettingRow>
          </div>
        );

      case 'shortcut':
        return (
          <div>
            <GroupTitle first>{lang === 'zh' ? '设置' : 'Settings'}</GroupTitle>
            <SettingRow label={t('settings.hotkey')}
              desc={lang === 'zh' ? '在任意位置唤起待办助手' : 'Summon TodoApp from anywhere'}>
              <span className="chip mono" style={{ fontSize: 11.5, padding: '6px 12px', borderRadius: 8, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                {hotkey || 'Alt+Shift+A'}
              </span>
            </SettingRow>
          </div>
        );

      case 'path':
        const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
        const WEEK_DAYS_LABELS = lang === 'zh'
          ? ['一', '二', '三', '四', '五', '六', '日']
          : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        return (
          <div>
            <GroupTitle first>{lang === 'zh' ? '存储' : 'Storage'}</GroupTitle>
            <SettingRow label={t('settings.downloadPath')}>
              <div className="flex items-center gap-2">
                <span className="text-xs truncate max-w-[180px]" style={{ color: 'var(--color-text-secondary)' }}>
                  {downloadPath || t('settings.pathUnset')}
                </span>
                <button onClick={handleSelectPath}
                  className="px-2 py-1 rounded text-xs border cursor-pointer transition-colors"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <FolderOpen size={12} />
                </button>
              </div>
            </SettingRow>
            <GroupTitle>{lang === 'zh' ? '提醒' : 'Reminders'}</GroupTitle>
            <SettingRow label={t('settings.achievementTime')}>
              <input type="time" value={achievementTime}
                onChange={(e) => setAchievementTime(e.target.value)}
                style={{
                  fontSize: 12, border: '0.5px solid var(--color-border)', borderRadius: 10,
                  padding: '5px 10px', background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-mono)', outline: 'none', width: 100,
                  accentColor: 'var(--clay)',
                }} />
            </SettingRow>
            <SettingRow label={lang === 'zh' ? '每周报告' : 'Weekly Report'}>
              <Switch on={weeklyReportEnabled} onChange={setWeeklyReportEnabled} />
            </SettingRow>
            {weeklyReportEnabled && (
              <>
                <div style={{ paddingLeft: 40 }}>
                  <SettingRow label={lang === 'zh' ? '报告日' : 'Report day'}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {WEEK_DAYS.map((d, i) => (
                        <button key={i} onClick={() => setWeeklyReportDay(i)}
                          style={{
                            width: 26, height: 26, borderRadius: '50%',
                            border: weeklyReportDay === i ? '1px solid var(--clay)' : '1px solid var(--color-border)',
                            background: weeklyReportDay === i ? 'var(--clay)' : 'transparent',
                            color: weeklyReportDay === i ? '#fff' : 'var(--color-text-tertiary)',
                            fontSize: 10, fontWeight: 500, cursor: 'pointer', display: 'grid', placeItems: 'center',
                            transition: 'background .1s, color .1s, border-color .1s',
                          }}
                        >{d}</button>
                      ))}
                    </div>
                  </SettingRow>
                  <SettingRow label={lang === 'zh' ? '报告时间' : 'Report time'} last>
                    <input type="time" value={weeklyReportTime}
                      onChange={(e) => setWeeklyReportTime(e.target.value)}
                      style={{
                        fontSize: 12, border: '0.5px solid var(--color-border)', borderRadius: 10,
                        padding: '5px 10px', background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-mono)', outline: 'none', width: 100,
                        accentColor: 'var(--clay)',
                      }} />
                  </SettingRow>
                </div>
              </>
            )}
          </div>
        );

      case 'ai':
        return <AISettings />;

      case 'export':
        return (
          <div className="flex flex-col" style={{ gap: 20 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 10 }}>
                {t('settings.export')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { icon: <FileJson size={22} />, label: 'JSON', sub: 'Full data', onClick: handleExportJSON },
                  { icon: <FileSpreadsheet size={22} />, label: 'CSV', sub: 'Spreadsheet', onClick: handleExportCSV },
                  { icon: <FileText size={22} />, label: 'PDF', sub: 'Printable report', onClick: () => { setSelectedTemplate('classic'); setShowPdfPicker(true); } },
                ].map((item, i) => (
                  <button key={i} onClick={item.onClick}
                    style={{
                      background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 12,
                      padding: '14px 12px', cursor: 'pointer', textAlign: 'center',
                      transition: 'transform .12s, box-shadow .12s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                  >
                    <div style={{ color: 'var(--clay)', marginBottom: 4 }}>{item.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>{item.sub}</div>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textAlign: 'center', paddingTop: 4 }}>
                {lang === 'zh' ? '导出文件将保存到设置的下载路径' : 'Exported files will be saved to your download path'}
              </div>
            </div>
          </div>
        );

      case 'backup':
        return <BackupPanel />;

      case 'import':
        return (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 10 }}>
              {lang === 'zh' ? '导入数据' : 'Import Data'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
              <button onClick={() => handleImport('json')}
                style={{
                  background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 12,
                  padding: '14px 12px', cursor: 'pointer', textAlign: 'center',
                  transition: 'transform .12s, box-shadow .12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                <div style={{ color: 'var(--clay)', marginBottom: 4 }}><FileJson size={22} /></div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>{lang === 'zh' ? 'JSON 导入' : 'JSON Import'}</div>
                <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>{lang === 'zh' ? '本应用备份 / 第三方工具' : 'App backup or 3rd-party'}</div>
              </button>
              <button onClick={() => handleImport('csv')}
                style={{
                  background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 12,
                  padding: '14px 12px', cursor: 'pointer', textAlign: 'center',
                  transition: 'transform .12s, box-shadow .12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                <div style={{ color: 'var(--clay)', marginBottom: 4 }}><FileSpreadsheet size={22} /></div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>{lang === 'zh' ? 'CSV 导入' : 'CSV Import'}</div>
                <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>{lang === 'zh' ? '本应用导出 / 任意 CSV 表格' : 'App export or any CSV'}</div>
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept=".json,.csv" style={{ display: 'none' }} onChange={handleFileSelected} />
            <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textAlign: 'center', marginTop: 12, lineHeight: 1.6 }}>
              {lang === 'zh'
                ? '支持本应用导出文件及其他工具的 JSON/CSV。导入前可预览并选择追加或替换。'
                : 'Supports app exports and 3rd-party JSON/CSV. Preview before importing with merge or replace options.'}
            </div>
          </div>
        );

      case 'about':
        const STATS = lang === 'zh'
          ? [{ label: '本地存储' }, { label: '无需账号' }, { label: '永久免费' }]
          : [{ label: '100% Local' }, { label: 'No Sign-up' }, { label: 'Free Forever' }];
        return (
          <div className="flex flex-col">
            {/* Hero */}
            <div style={{ textAlign: 'center', padding: '16px 0 14px' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--clay)', letterSpacing: '-0.02em' }}>
                {t('app.title')}
              </div>
              <div style={{ display: 'inline-block', fontSize: 9, fontWeight: 500, background: 'var(--color-bg-tertiary)', padding: '2px 10px', borderRadius: 999, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                v0.1.0
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 6 }}>
                {t('settings.aboutTagline')}
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '12px 0' }}>
                <span style={{ fontSize: 9, fontWeight: 500, background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '2px 10px', color: 'var(--color-text-tertiary)' }}>Tauri v2</span>
                <span style={{ fontSize: 9, fontWeight: 500, background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '2px 10px', color: 'var(--color-text-tertiary)' }}>React 19</span>
                <span style={{ fontSize: 9, fontWeight: 500, background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '2px 10px', color: 'var(--color-text-tertiary)' }}>{lang === 'zh' ? '本地优先' : 'Local-first'}</span>
              </div>
            </div>
            <hr style={{ border: 'none', borderTop: '0.5px solid var(--color-border)', margin: '4px 0 16px' }} />

            {/* Stat badges — centered pill row */}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
              {STATS.map((item, i) => (
                <span key={i}
                  style={{
                    fontSize: 9.5, fontWeight: 600, letterSpacing: '0.02em',
                    background: 'var(--clay-light, #f5e6e0)', color: 'var(--clay)',
                    padding: '3px 14px', borderRadius: 999,
                  }}
                >
                  {item.label}
                </span>
              ))}
            </div>

            {/* Body */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11.5, lineHeight: 1.7, color: 'var(--color-text-secondary)', margin: 0 }}>
                {t('settings.aboutBody')}
              </p>
            </div>

            {/* Two-column: Highlights + Compare */}
            <div style={{ display: 'flex', gap: 10 }}>
              {/* Highlights — olive */}
              <div style={{
                flex: 1, padding: '14px 14px', borderRadius: 10,
                background: 'var(--color-bg-tertiary)',
                border: '0.5px solid var(--color-border)',
                borderLeft: '2px solid var(--olive)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--olive)' }} />
                  <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--olive)' }}>
                    {t('settings.aboutHighlights')}
                  </span>
                </div>
                <p style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--color-text-tertiary)', margin: 0 }}>
                  {t('settings.aboutHighlightsBody')}
                </p>
              </div>

              {/* Compare — clay */}
              <div style={{
                flex: 1, padding: '14px 14px', borderRadius: 10,
                background: 'var(--color-bg-tertiary)',
                border: '0.5px solid var(--color-border)',
                borderLeft: '2px solid var(--clay)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--clay)' }} />
                  <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--clay)' }}>
                    {t('settings.aboutCompare')}
                  </span>
                </div>
                <p style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--color-text-tertiary)', margin: 0 }}>
                  {t('settings.aboutCompareBody')}
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  }
}
