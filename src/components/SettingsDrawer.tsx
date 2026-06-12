import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, type AccentColor } from '../store/settingsStore';
import { useTodoStore } from '../store/todoStore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderOpen, Save, Upload, FileText, FileJson, FileSpreadsheet } from 'lucide-react';
import { todosToCSV, saveFileWithDialog } from '../lib/csv-export';
import { useSheet } from '../lib/responsive';
import { useToast } from './Toast';
import AISettings from './settings/AISettings';

type NavSection = 'appearance' | 'shortcut' | 'path' | 'ai' | 'export' | 'import' | 'about';
type NavGroup = 'general' | 'ai' | 'data' | 'about';

interface NavItem {
  key: NavSection;
  label: string;
  group: NavGroup;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'appearance', label: 'settings.navAppearance', group: 'general' },
  { key: 'shortcut', label: 'settings.navShortcut', group: 'general' },
  { key: 'path', label: 'settings.navPath', group: 'general' },
  { key: 'ai', label: 'settings.navAI', group: 'ai' },
  { key: 'export', label: 'settings.navExport', group: 'data' },
  { key: 'import', label: 'settings.navImport', group: 'data' },
  { key: 'about', label: 'settings.navAbout', group: 'about' },
];

// 分组强调色 — 仅用于分组标签文字本身的着色，不再使用色点装饰
const GROUP_ACCENT: Record<NavGroup, string> = {
  general: 'var(--clay)',
  ai: 'var(--fig, #c46686)',
  data: 'var(--sky)',
  about: 'var(--olive)',
};

const GROUP_LABEL_KEY: Record<NavGroup, string> = {
  general: 'settings.groupGeneral',
  ai: 'settings.groupAI',
  data: 'settings.groupData',
  about: 'settings.groupAbout',
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
    <div className="flex items-center justify-between" style={{ padding: '10px 2px', borderBottom: '0.5px solid var(--color-separator)' }}>
      <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function ToggleGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex rounded-md overflow-hidden border flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>{children}</div>;
}

function ToggleBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className="text-[11px] font-medium transition-all cursor-pointer flex-shrink-0"
      style={{
        padding: '5px 12px',
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
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
    accentColor, setAccentColor,
    startupDelay, setStartupDelay, hotkey, setHotkey,
    downloadPath, setDownloadPath,
    isOpen, setIsOpen,
    achievementTime, setAchievementTime,
    weeklyReportEnabled, weeklyReportDay, weeklyReportTime,
    setWeeklyReportEnabled, setWeeklyReportDay, setWeeklyReportTime,
  } = useSettingsStore();
  const { todos, setTodos } = useTodoStore();
  const { show } = useToast();
  const sheet = useSheet();

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

  const handleExportJSON = async () => {
    const json = JSON.stringify(todos, null, 2);
    await saveFileWithDialog(json, 'todoapp-' + today + '.json', 'application/json', downloadPath);
    show(t('settings.exportSuccess'));
  };

  const handleExportCSV = async () => {
    const csv = todosToCSV(todos);
    await saveFileWithDialog(csv, 'todoapp-' + today + '.csv', 'text/csv', downloadPath);
    show(t('settings.exportSuccess'));
  };

  const handleBackup = async () => {
    const backupData = JSON.stringify({ todos, exportedAt: new Date().toISOString() }, null, 2);
    await saveFileWithDialog(backupData, 'todoapp-backup-' + today + '.json', 'application/json', downloadPath);
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
          // 兼容旧备份：补齐新增字段默认值，避免缺字段导致排序异常
          const normalized = imported.map((it, i) => ({
            ...it,
            priority: typeof it.priority === 'number' ? it.priority : 0,
            sortOrder: typeof it.sortOrder === 'number' ? it.sortOrder : i + 1,
          }));
          setTodos(normalized);
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
          {/* 定位层：桌面居中、手机贴底 sheet（flex 居中避免与 scale transform 冲突）*/}
          <div className={`fixed inset-0 z-50 flex justify-center pointer-events-none ${sheet.alignClass}`}>
          <motion.div
            {...sheet.motion}
            className={`${sheet.isPhone ? 'flex-col' : ''} flex overflow-hidden pointer-events-auto`}
            style={{
              ...sheet.panelStyle({ width: 'min(760px, 92vw)', height: 'min(560px, 88vh)' }),
              ...(sheet.isPhone ? { height: 'min(85dvh, 640px)' } : null),
              backgroundColor: 'var(--color-bg-secondary)',
              border: '0.5px solid var(--color-border)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {sheet.isPhone ? (
              /* 手机：顶部横向 tab 栏（分组扁平化，横向滚动） */
              <div className="flex-shrink-0 border-b flex items-center overflow-x-auto" style={{ borderColor: 'var(--color-border)', padding: '8px 12px', gap: '6px' }}>
                {NAV_ITEMS.map((item) => {
                  const isActive = activeNav === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setActiveNav(item.key)}
                      className="flex-shrink-0 transition-all cursor-pointer rounded-lg"
                      style={{
                        height: '38px',
                        padding: '0 14px',
                        fontSize: '13px',
                        whiteSpace: 'nowrap',
                        color: isActive ? 'var(--color-fill-text)' : 'var(--color-text-tertiary)',
                        backgroundColor: isActive ? 'var(--color-fill)' : 'var(--color-bg-tertiary)',
                        fontWeight: isActive ? 500 : 400,
                        border: 'none',
                      }}
                    >
                      {t(item.label)}
                    </button>
                  );
                })}
              </div>
            ) : (
            /* 桌面：Left nav — 150px per spec */
            <div className="flex-shrink-0 border-r flex flex-col" style={{ width: '150px', borderColor: 'var(--color-border)' }}>
              <div className="px-4 py-3 border-b flex items-center" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)', letterSpacing: 'var(--tracking-normal)' }}>
                  {t('settings.title')}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto py-1.5">
                {(['general', 'data', 'about'] as const).map((group, gi) => {
                  const items = NAV_ITEMS.filter((item) => item.group === group);
                  // "关于" 分组下只有一个同名条目，单独显示分组标题会造成「关于」标题重复，因此跳过
                  const showGroupLabel = !(items.length === 1 && GROUP_LABEL_KEY[group] === items[0].label);
                  return (
                  <div key={group} style={{ marginTop: gi === 0 ? 0 : '12px' }}>
                    {showGroupLabel && (
                      <div className="px-4 pb-1.5 select-none">
                        <span className="text-[9px] font-medium uppercase tracking-widest" style={{ color: GROUP_ACCENT[group] }}>
                          {t(GROUP_LABEL_KEY[group])}
                        </span>
                      </div>
                    )}
                    <div className="px-2.5 flex flex-col" style={{ gap: '2px' }}>
                    {items.map((item) => {
                      const isActive = activeNav === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() => setActiveNav(item.key)}
                          className="w-full text-left flex items-center gap-2 transition-all cursor-pointer rounded-md"
                          style={{
                            height: '30px',
                            padding: '0 10px',
                            fontSize: '11px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            color: isActive ? 'var(--color-fill-text)' : 'var(--color-text-tertiary)',
                            backgroundColor: isActive ? 'var(--color-fill)' : 'transparent',
                            fontWeight: isActive ? 500 : 400,
                          }}
                          onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                          onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                        >
                          {t(item.label)}
                        </button>
                      );
                    })}
                    </div>
                  </div>
                  );
                })}
              </div>
              <div className="px-4 py-2.5 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-[9px]" style={{ color: 'var(--color-text-tertiary)' }}>v0.1.0</span>
              </div>
            </div>
            )}

            {/* Right panel */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)', padding: sheet.isPhone ? '12px 16px' : '14px 26px' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {t(NAV_ITEMS.find((i) => i.key === activeNav)?.label ?? '')}
                </span>
                <button onClick={() => setIsOpen(false)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer" style={{ color: 'var(--color-text-tertiary)' }}>
                  <X size={13} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto" style={{ padding: sheet.isPhone ? '20px 16px' : '28px 32px' }}>
                {activeNav === 'appearance' && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
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
                        <ToggleBtn active={theme === 'system'} onClick={() => setTheme('system')} label={t('settings.systemMode')} />
                      </ToggleGroup>
                    </SettingRow>
                    <SettingRow label={lang === 'zh' ? '主题色' : 'Accent Color'}>
                      <div className="flex items-center" style={{ gap: '8px' }}>
                        {([
                          { key: 'coral', color: '#d97757', label: lang === 'zh' ? '珊瑚橙' : 'Coral' },
                          { key: 'olive', color: '#788c5d', label: lang === 'zh' ? '橄榄绿' : 'Olive' },
                          { key: 'sky',   color: '#6a9bcc', label: lang === 'zh' ? '天空蓝' : 'Sky'   },
                          { key: 'fig',   color: '#c46686', label: lang === 'zh' ? '玫瑰紫' : 'Fig'   },
                        ] as { key: AccentColor; color: string; label: string }[]).map(({ key, color, label }) => (
                          <button
                            key={key}
                            title={label}
                            onClick={() => setAccentColor(key)}
                            style={{
                              width: '22px', height: '22px', borderRadius: '50%',
                              backgroundColor: color, border: 'none', cursor: 'pointer',
                              outline: (accentColor ?? 'coral') === key ? `2.5px solid ${color}` : '2.5px solid transparent',
                              outlineOffset: '2px',
                              boxShadow: (accentColor ?? 'coral') === key ? `0 0 0 1px rgba(0,0,0,0.12)` : 'none',
                              transition: 'outline 0.15s, box-shadow 0.15s',
                            }}
                          />
                        ))}
                      </div>
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
                    <SettingRow label={t('settings.achievementTime')}>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={achievementTime}
                          onChange={(e) => setAchievementTime(e.target.value)}
                          className="text-xs rounded border outline-none transition-colors"
                          style={{
                            padding: '4px 8px',
                            fontFamily: 'var(--font-mono)',
                            backgroundColor: 'var(--color-bg-tertiary)',
                            color: 'var(--color-text-secondary)',
                            borderColor: 'var(--color-border)',
                            accentColor: 'var(--clay)',
                          }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--clay)'; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                        />
                        {achievementTime && (
                          <button
                            onClick={() => setAchievementTime('')}
                            className="text-[10px] transition-colors cursor-pointer"
                            style={{ color: 'var(--color-text-tertiary)', background: 'none', border: 'none', padding: 0 }}
                            title={t('settings.achievementOff')}
                          >
                            {t('settings.achievementOff')}
                          </button>
                        )}
                      </div>
                    </SettingRow>
                    <SettingRow label={lang === 'zh' ? '每周报告' : 'Weekly Report'}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setWeeklyReportEnabled(!weeklyReportEnabled)}
                          className="transition-colors cursor-pointer"
                          style={{
                            fontSize: '10px', padding: '2px 8px', borderRadius: '10px',
                            border: '0.5px solid', fontWeight: 500,
                            borderColor: weeklyReportEnabled ? 'var(--clay)' : 'var(--color-border)',
                            backgroundColor: weeklyReportEnabled ? 'var(--clay-light)' : 'transparent',
                            color: weeklyReportEnabled ? 'var(--clay)' : 'var(--color-text-tertiary)',
                          }}
                        >{weeklyReportEnabled ? (lang === 'zh' ? '已开启' : 'On') : (lang === 'zh' ? '已关闭' : 'Off')}</button>
                        {weeklyReportEnabled && (<>
                          <select
                            value={weeklyReportDay}
                            onChange={(e) => setWeeklyReportDay(Number(e.target.value))}
                            className="text-xs rounded border outline-none cursor-pointer"
                            style={{ padding: '3px 6px', backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)', accentColor: 'var(--clay)' }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--clay)'; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                          >
                            {(lang === 'zh'
                              ? ['周日','周一','周二','周三','周四','周五','周六']
                              : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
                            ).map((d, i) => (
                              <option key={i} value={i}>{d}</option>
                            ))}
                          </select>
                          <input
                            type="time"
                            value={weeklyReportTime}
                            onChange={(e) => setWeeklyReportTime(e.target.value)}
                            className="text-xs rounded border outline-none transition-colors"
                            style={{ padding: '3px 6px', fontFamily: 'var(--font-mono)', backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)', accentColor: 'var(--clay)' }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--clay)'; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                          />
                        </>)}
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

                {activeNav === 'ai' && <AISettings />}

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
                  <div className="flex flex-col" style={{ gap: '16px' }}>
                    {/* 导出格式分组 */}
                    <div
                      className="flex flex-col"
                      style={{ borderRadius: 10, border: '0.5px solid var(--color-border)', overflow: 'hidden' }}
                    >
                      <div className="px-3 py-2" style={{ backgroundColor: 'var(--color-bg-tertiary)', borderBottom: '0.5px solid var(--color-border)' }}>
                        <span className="text-[9px] font-medium uppercase tracking-widest" style={{ color: 'var(--clay)' }}>
                          {t('settings.export')}
                        </span>
                      </div>
                      <div className="flex flex-col" style={{ gap: '2px', padding: '6px' }}>
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
                      </div>
                    </div>

                    {/* 备份分组 */}
                    <div
                      className="flex flex-col"
                      style={{ borderRadius: 10, border: '0.5px solid var(--color-border)', overflow: 'hidden' }}
                    >
                      <div className="px-3 py-2" style={{ backgroundColor: 'var(--color-bg-tertiary)', borderBottom: '0.5px solid var(--color-border)' }}>
                        <span className="text-[9px] font-medium uppercase tracking-widest" style={{ color: 'var(--sky)' }}>
                          {t('settings.backup')}
                        </span>
                      </div>
                      <div style={{ padding: '6px' }}>
                        <ExportRow icon={<Save size={13} />} label={t('settings.backupNow')} onClick={handleBackup} />
                      </div>
                    </div>
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

                {activeNav === 'about' && (
                  <div className="flex flex-col" style={{ gap: '16px' }}>
                    <div className="flex items-center" style={{ gap: '12px' }}>
                      <div
                        className="flex items-center justify-center flex-shrink-0"
                        style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'var(--clay)', color: 'var(--ivory-light)' }}
                      >
                        <span className="text-base font-semibold">T</span>
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{t('app.title')}</div>
                        <div className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{t('settings.version')} 0.1.0</div>
                      </div>
                    </div>

                    <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                      {t('settings.aboutTagline')}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                      {t('settings.aboutBody')}
                    </p>

                    <div
                      className="flex flex-col"
                      style={{ gap: '6px', padding: '14px 16px', borderRadius: 10, border: '0.5px solid var(--color-border)', backgroundColor: 'var(--color-bg-tertiary)' }}
                    >
                      <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--olive)' }}>
                        {t('settings.aboutHighlights')}
                      </span>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
                        {t('settings.aboutHighlightsBody')}
                      </p>
                    </div>

                    <div
                      className="flex flex-col"
                      style={{ gap: '6px', padding: '14px 16px', borderRadius: 10, border: '0.5px solid var(--color-border)', backgroundColor: 'var(--color-bg-tertiary)' }}
                    >
                      <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--sky)' }}>
                        {t('settings.aboutCompare')}
                      </span>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
                        {t('settings.aboutCompareBody')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
          </div>

          {/* PDF Template Picker — per spec: 2x2 grid, visual previews, select + export */}
          {showPdfPicker && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ backgroundColor: 'rgba(0,0,0,0.45)', padding: '32px' }}
              onClick={() => setShowPdfPicker(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="rounded-xl pdf-picker-scroll"
                style={{
                  width: 'min(560px, 92vw)',
                  maxHeight: '86vh',
                  overflowY: 'auto',
                  padding: '24px',
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '0.5px solid var(--color-border)',
                  boxShadow: 'var(--shadow-lg)',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'transparent transparent',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: '18px' }}>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{t('pdf.title')}</h2>
                  <button onClick={() => setShowPdfPicker(false)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer" style={{ color: 'var(--color-text-tertiary)' }}>
                    <X size={13} />
                  </button>
                </div>

                {/* 2x2 grid with visual previews */}
                <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '16px' }}>
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
                <div className="flex flex-col gap-2.5" style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: 8, border: '0.5px dashed var(--color-border)', backgroundColor: 'var(--color-bg-primary)' }}>
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
                <div className="flex items-center justify-between" style={{ paddingTop: '16px', borderTop: '0.5px solid var(--color-border)' }}>
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {t('pdf.selectedLabel')}
                    <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{t(selectedTmpl.labelKey)}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPdfPicker(false)}
                      className="rounded-md text-xs font-medium transition-colors cursor-pointer"
                      style={{
                        padding: '7px 18px',
                        whiteSpace: 'nowrap',
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
                      className="rounded-md text-xs font-medium transition-colors cursor-pointer"
                      style={{
                        padding: '7px 18px',
                        whiteSpace: 'nowrap',
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
