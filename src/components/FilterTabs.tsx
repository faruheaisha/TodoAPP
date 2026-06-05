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

  // Count by status
  const activeCount = todos.filter((t) => !t.completed).length;
  const completedCount = todos.filter((t) => t.completed).length;

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: todos.length },
    { key: 'active', label: '进行中', count: activeCount },
    { key: 'completed', label: '已完成', count: completedCount },
  ];

  // Use internal state if no external control
  const [internalFilter, setInternalFilter] = React.useState<FilterType>('all');
  const activeFilter = externalFilter ?? internalFilter;
  const setFilter = onFilterChange ?? setInternalFilter;

  return (
    <div className="flex gap-1 px-5 pb-2" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      {filters.map((f) => {
        const isActive = activeFilter === f.key;
        return (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="px-3 py-1 rounded text-xs font-medium transition-all border"
            style={{
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              backgroundColor: isActive ? 'var(--color-bg-tertiary)' : 'transparent',
              borderColor: isActive ? 'var(--color-text-primary)' : 'var(--color-border)',
              fontWeight: isActive ? 500 : 400,
            }}
          >
            {f.label}
            {f.count > 0 && (
              <span
                className="ml-1"
                style={{
                  color: isActive ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)',
                  opacity: isActive ? 1 : 0.6,
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