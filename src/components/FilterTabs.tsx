import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTodoStore } from '../store/todoStore';
import { useSettingsStore } from '../store/settingsStore';
import { isInTodayView } from '../lib/utils';

export type FilterType = 'today' | 'all' | 'active' | 'completed';

interface FilterTabsProps {
  activeFilter?: FilterType;
  onFilterChange?: (filter: FilterType) => void;
}

/* ── Inline SVG icons ── */

function SearchIcon() {
  return (
    <svg
      width="15" height="15" viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', color: 'var(--ink-2)' }}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg
      width="15" height="15" viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block' }}
    >
      <path d="M7 4v16" />
      <path d="M4 8l3-4 3 4" />
      <path d="M14 8h6" />
      <path d="M14 12h4" />
      <path d="M14 16h2" />
    </svg>
  );
}

/* ── Component ── */

export default function FilterTabs({ activeFilter: externalFilter, onFilterChange }: FilterTabsProps) {
  const { t, i18n } = useTranslation();
  const { todos } = useTodoStore();
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';

  const [internalFilter, setInternalFilter] = React.useState<FilterType>('all');
  const activeFilter = externalFilter ?? internalFilter;
  const setFilter = onFilterChange ?? setInternalFilter;

  const sortMode = useSettingsStore((s) => s.sortMode);
  const setSortMode = useSettingsStore((s) => s.setSortMode);
  const isManual = sortMode === 'manual';

  const activeCount = todos.filter((t) => !t.completed).length;
  const completedCount = todos.filter((t) => t.completed).length;
  const allCount = todos.length;
  const todayCount = todos.filter(isInTodayView).length;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 var(--pad-x)',
        height: 'var(--filter-row-h)',
        backgroundColor: 'var(--color-bg-primary)',
      }}
    >
      {/* ── Search pill (Linear-style) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flex: '0 0 auto',
          background: 'var(--color-bg-input)',
          border: '0.5px solid var(--color-border)',
          borderRadius: 7,
          padding: '0 10px',
          gap: 7,
          height: 30,
          minWidth: 160,
        }}
      >
        <SearchIcon />
        <input
          placeholder={lang === 'zh' ? '搜索任务…' : 'Search tasks…'}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            font: 'inherit',
            fontSize: 12.5,
            width: 110,
            color: 'var(--color-text-primary)',
          }}
        />
      </div>

      {/* ── Filter pills ── */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          flex: 1,
          minWidth: 0,
          overflowX: 'auto',
        }}
      >
        {[
          { key: 'today' as FilterType, label: t('app.filterToday'), count: todayCount },
          { key: 'all' as FilterType, label: t('app.filterAll'), count: allCount },
          { key: 'active' as FilterType, label: t('app.filterActive'), count: activeCount },
          { key: 'completed' as FilterType, label: t('app.filterCompleted'), count: completedCount },
        ].map((f) => {
          const isActive = activeFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={'linear-ghost-btn' + (isActive ? ' active' : '')}
              style={{ fontSize: 12.5 }}
            >
              {f.label}
              {f.count > 0 && (
                <span className="linear-count-badge">{f.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Sort toggle ── */}
      <button
        onClick={() => setSortMode(isManual ? 'smart' : 'manual')}
        className="linear-ghost-btn"
        title={isManual ? t('app.sortManualHint') : t('app.sortSmartHint')}
        style={{ fontSize: 12.5, flex: '0 0 auto' }}
      >
        <SortIcon />
        {isManual ? t('app.sortManual') : t('app.sortSmart')}
      </button>
    </div>
  );
}
