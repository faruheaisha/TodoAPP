import { useEffect, useRef } from 'react';
import { Pencil, Download, Trash2 } from 'lucide-react';

interface Props {
  sessionId: string;
  position: { x: number; y: number };
  onRename: () => void;
  onDelete: () => void;
  onExport: () => void;
  onClose: () => void;
  lang: 'zh' | 'en';
}

export default function SessionContextMenu({ position, onRename, onDelete, onExport, onClose, lang }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Clamp to viewport
  const menuW = 180;
  const menuH = 120;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = position.x;
  let y = position.y;
  if (x + menuW > vw - 8) x = vw - menuW - 8;
  if (y + menuH > vh - 8) y = vh - menuH - 8;
  if (x < 8) x = 8;
  if (y < 8) y = 8;

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '8px',
    width: '100%', padding: '7px 10px', border: 'none',
    borderRadius: '6px', background: 'transparent',
    font: 'inherit', fontSize: '12px', cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    textAlign: 'left', lineHeight: 1.2,
  };

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left: x, top: y, zIndex: 100,
        width: `${menuW}px`,
        background: 'var(--color-bg-secondary)',
        border: '0.5px solid var(--color-border)',
        borderRadius: '10px',
        padding: '4px',
        boxShadow: '0 6px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      <button style={itemStyle} onClick={() => { onRename(); onClose(); }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-tertiary)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <Pencil size={12} />
        {lang === 'zh' ? '重命名' : 'Rename'}
      </button>
      <button style={itemStyle} onClick={() => { onExport(); onClose(); }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-tertiary)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <Download size={12} />
        {lang === 'zh' ? '导出 Markdown' : 'Export as Markdown'}
      </button>
      <button style={{ ...itemStyle, color: '#C4502E' }} onClick={() => { onDelete(); onClose(); }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#FCF3F1')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <Trash2 size={12} />
        {lang === 'zh' ? '删除' : 'Delete'}
      </button>
    </div>
  );
}
