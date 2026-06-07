import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTodoStore } from '../store/todoStore';

export type FilterType = 'all' | 'active' | 'completed';

interface FilterTabsProps {
  activeFilter?: FilterType;
  onFilterChange?: (filter: FilterType) => void;
}

export default function FilterTabs({ activeFilter: externalFilter, onFilterChange }: FilterTabsProps) {
  const { t } = useTranslation();
  const { todos } = useTodoStore();

  const activeCount = todos.filter((t) => !t.completed).length;
  const completedCount = todos.filter((t) => t.completed).length;

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: t('app.filterAll'), count: todos.length },
    { key: 'active', label: t('app.filterActive'), count: activeCount },
    { key: 'completed', label: t('app.filterCompleted'), count: completedCount },
  ];

  const [internalFilter, setInternalFilter] = React.useState<FilterType>('all');
  const activeFilter = externalFilter ?? internalFilter;
  const setFilter = onFilterChange ?? setInternalFilter;

  return (
    <div
      className="flex flex-shrink-0"
      style={{
        gap: '4px',
        padding: '5px 14px',
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
              padding: '2px 9px',
              borderRadius: '4px',
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
    </div>
  );
}
