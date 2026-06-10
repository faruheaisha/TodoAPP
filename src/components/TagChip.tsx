import type { Tag } from '../store/tagStore';

interface TagChipProps {
  tag: Tag;
  onRemove?: () => void;
  onClick?: () => void;
  size?: 'sm' | 'xs';
  active?: boolean;
}

/**
 * TagChip — 标签药丸组件
 * 参考 Todoist label chip 设计：颜色点 + 名称，可选移除按钮
 */
export function TagChip({ tag, onRemove, onClick, size = 'xs', active = false }: TagChipProps) {
  const fs = size === 'sm' ? '11px' : '9px';
  const px = size === 'sm' ? '7px' : '5px';
  const py = '1px';

  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        padding: `${py} ${px}`, borderRadius: '10px',
        fontSize: fs, fontWeight: 500, cursor: onClick ? 'pointer' : 'default',
        backgroundColor: active ? tag.color + '33' : tag.color + '18',
        border: `0.5px solid ${tag.color}${active ? '88' : '44'}`,
        color: tag.color,
        transition: 'all 0.12s',
        userSelect: 'none',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        if (onClick) (e.currentTarget as HTMLElement).style.backgroundColor = tag.color + '33';
      }}
      onMouseLeave={e => {
        if (onClick) (e.currentTarget as HTMLElement).style.backgroundColor = active ? tag.color + '33' : tag.color + '18';
      }}
    >
      <span style={{
        width: size === 'sm' ? '5px' : '4px',
        height: size === 'sm' ? '5px' : '4px',
        borderRadius: '50%',
        backgroundColor: tag.color,
        flexShrink: 0,
      }} />
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: tag.color, padding: 0, lineHeight: 1,
            fontSize: '10px', marginLeft: '1px',
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}
