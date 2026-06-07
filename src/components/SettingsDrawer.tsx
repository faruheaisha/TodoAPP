import React from 'react';
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
  group: '通用' | '数据';
}

const NAV_ITEMS: NavItem[] = [
  { key: 'appearance', label: '外观与语言', group: '通用' },
  { key: 'shortcut', label: '快捷键', group: '通用' },
  { key: 'path', label: '存储路径', group: '通用' },
  { key: 'export', label: '导出数据', group: '数据' },
  { key: 'import', label: '导入备份', group: '数据' },
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
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().split('T')[0];

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, setIsOpen]);

  const handleExportJSON = () => {
    exportTodosJSON(todos, 'todoapp-' + today + '.json');
    show('已导出 JSON');
  };

  const handleExportCSV = () => {
    exportTodosCSV(todos, 'todoapp-' + today + '.csv');
    show('已导出 CSV');
  };

  const handleBackup = () => {
    const backupData = JSON.stringify({ todos, exportedAt: new Date().toISOString() }, null, 2);
    downloadFile(backupData, 'todoapp-backup-' + today + '.json', 'application/json');
    show('备份完成');
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
          show('已导入 ' + imported.length + ' 条待办');
        } else {
          show('文件格式无效');
        }
      } catch {
        show('导入失败，请检查文件格式');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportPDF = () => {
    import('../lib/pdf-export').then(({ exportTodosPDF }) => {
      exportTodosPDF(todos, language as 'zh' | 'en');
      show('已导出 PDF');
    }).catch((err) => {
      console.error('PDF export failed:', err);
      show('PDF 导出失败');
    });
  };

  const handleSelectPath = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false, title: '选择导出路径' });
      if (selected && typeof selected === 'string') {
        setDownloadPath(selected);
        show('路径已设置');
      }
    } catch {
      const fallback = prompt('请输入导出路径:', downloadPath || 'C:\\Users\\DELL\\Downloads');
      if (fallback) {
        setDownloadPath(fallback);
        show('路径已设置');
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
              width: 'min(680px, 90vw)',
              maxHeight: '90vh',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '0.5px solid var(--color-border)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Left nav */}
            <div className="flex-shrink-0 border-r flex flex-col" style={{ width: '160px', borderColor: 'var(--color-border)' }}>
              <div className="px-4 py-3 border-b flex items-center" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)', letterSpacing: 'var(--tracking-normal)' }}>
                  {t('settings.title')}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {(['通用', '数据'] as const).map((group) => (
                  <div key={group}>
                    <div className="px-4 pt-3 pb-1 text-[9px] font-medium uppercase tracking-widest select-none" style={{ color: 'var(--color-text-tertiary)' }}>
                      {group}
                    </div>
                    {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                      const isActive = activeNav === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() => setActiveNav(item.key)}
                          className="w-full text-left flex items-center gap-2 transition-all"
                          style={{
                            height: '30px',
                            padding: '0 12px',
                            fontSize: '12px',
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
              <div className="px-4 py-2.5 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-[9px]" style={{ color: 'var(--color-text-tertiary)' }}>v0.1.0</span>
              </div>
            </div>

            {/* Right panel */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {NAV_ITEMS.find((i) => i.key === activeNav)?.label}
                </span>
                <button onClick={() => setIsOpen(false)} className="w-6 h-6 rounded flex items-center justify-center" style={{ color: 'var(--color-text-tertiary)' }}>
                  <X size={14} />
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
                      className="px-3 py-1.5 rounded text-xs border transition-all min-w-[120px] text-center"
                      style={{
                        borderColor: recording ? 'var(--clay)' : 'var(--color-border)',
                        backgroundColor: recording ? 'var(--clay-light)' : 'var(--color-bg-tertiary)',
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {recording ? '按组合键...' : hotkey}
                    </button>
                  </SettingRow>
                )}

                {activeNav === 'path' && (
                  <SettingRow label={t('settings.downloadPath')}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs truncate max-w-[130px]" style={{ color: 'var(--color-text-secondary)' }}>
                        {downloadPath || '未设置'}
                      </span>
                      <button onClick={handleSelectPath} className="px-2 py-1 rounded text-xs border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                        <FolderOpen size={12} />
                      </button>
                    </div>
                  </SettingRow>
                )}

                {activeNav === 'export' && (
                  <div className="space-y-1">
                    <ExportRow icon={<FileText size={13} />} label="导出为 PDF" feature="特色" onClick={handleExportPDF} />
                    <ExportRow icon={<FileJson size={13} />} label="导出为 JSON" onClick={handleExportJSON} />
                    <ExportRow icon={<FileSpreadsheet size={13} />} label="导出为 CSV" onClick={handleExportCSV} />
                    <ExportRow icon={<Save size={13} />} label="立即备份" onClick={handleBackup} />
                  </div>
                )}

                {activeNav === 'import' && (
                  <>
                    <ExportRow icon={<Upload size={13} />} label="导入备份" onClick={handleImport} />
                    <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileSelected} />
                    <p className="text-[10px] px-1" style={{ color: 'var(--color-text-tertiary)' }}>
                      支持 JSON 备份文件，将替换当前所有待办事项
                    </p>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: '0.5px solid var(--color-bg-tertiary)' }}>
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
    <button onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all"
      style={{ color: 'var(--color-text-secondary)', backgroundColor: 'transparent' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      <span style={{ color: 'var(--color-text-tertiary)' }}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {feature && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: '#E1F5EE', color: '#0F6E56' }}>{feature}</span>}
      <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>{'→'}</span>
    </button>
  );
}
