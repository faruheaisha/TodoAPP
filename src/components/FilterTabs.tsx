import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownWideNarrow, GripVertical } from 'lucide-react';
import { useTodoStore } from '../store/todoStore';
import { useSettingsStore } from '../store/settingsStore';
import { isInTodayView } from '../lib/utils';
import { useIsTouch } from '../lib/responsive';

export type FilterType = 'today' | 'all' | 'active' | 'completed';

interface FilterTabsProps {
  activeFilter?: FilterType;
  onFilterChange?: (filter: FilterType) => void;
}

export default function FilterTabs({ activeFilter: externalFilter, onFilterChange }: FilterTabsProps) {
  const { t } = useTranslation();
  const { todos } = useTodoStore();
  const isTouch = useIsTouch();

  const activeCount = todos.filter((t) => !t.completed).length;
  const completedCount = todos.filter((t) => t.completed).length;
  const todayCount = todos.filter(isInTodayView).length;

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'today', label: t('app.filterToday'), count: todayCount },
    { key: 'all', label: t('app.filterAll'), count: todos.length },
    { key: 'active', label: t('app.filterActive'), count: activeCount },
    { key: 'completed', label: t('app.filterCompleted'), count: completedCount },
  ];

  const [internalFilter, setInternalFilter] = React.useState<FilterType>('all');
  const activeFilter = externalFilter ?? internalFilter;
  const setFilter = onFilterChange ?? setInternalFilter;

  const sortMode = useSettingsStore((s) => s.sortMode);
  const setSortMode = useSettingsStore((s) => s.setSortMode);
  const isManual = sortMode === 'manual';

  return (
    <div
      className="flex flex-shrink-0 items-center"
      style={{
        gap: '4px',
        padding: '5px var(--pad-x)',
        height: 'var(--filter-row-h)',
        backgroundColor: 'var(--color-bg-primary)',
      }}
    >
      {filters.map((f) => {
        const isActive = activeFilter === f.key;
        return (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="text-xs font-medium transition-colors cursor-pointer"
            style={{
              padding: isTouch ? '6px 14px' : '2px 9px',
              borderRadius: isTouch ? '6px' : '4px',
              border: '0.5px solid',
              borderColor: isActive ? 'var(--color-fill)' : 'var(--color-border)',
              color: isActive ? 'var(--color-fill-text)' : 'var(--color-text-tertiary)',
              backgroundColor: isActive ? 'var(--color-fill)' : 'transparent',
              fontWeight: isActive ? 500 : 400,
            }}
          >
            {f.label}
            {f.count > 0 && (
              <span
                className="ml-1"
                style={{
                  color: isActive ? 'var(--color-fill-text)' : 'var(--color-text-tertiary)',
                  opacity: isActive ? 0.8 : 0.6,
                }}
              >
                {f.count}
              </span>
            )}
          </button>
        );
      })}

      {/* 排序模式切换：智能（优先级+截止）/ 手动（拖拽） */}
      <button
        onClick={() => setSortMode(isManual ? 'smart' : 'manual')}
        className="text-xs font-medium transition-colors cursor-pointer flex items-center ml-auto"
        title={isManual ? t('app.sortManualHint') : t('app.sortSmartHint')}
        style={{
          gap: '4px',
          padding: isTouch ? '6px 12px' : '2px 8px',
          borderRadius: isTouch ? '6px' : '4px',
          border: '0.5px solid',
          borderColor: isManual ? 'var(--clay)' : 'var(--color-border)',
          color: isManual ? 'var(--clay)' : 'var(--color-text-tertiary)',
          backgroundColor: isManual ? 'var(--clay-light)' : 'transparent',
        }}
      >
        {isManual ? <GripVertical size={11} /> : <ArrowDownWideNarrow size={11} />}
        {isManual ? t('app.sortManual') : t('app.sortSmart')}
      </button>
    </div>
  );
}
