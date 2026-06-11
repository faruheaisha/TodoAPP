import type { Priority } from '../store/todoStore';

/**
 * 优先级元数据 —— 单一事实来源
 *
 * 颜色采用固定十六进制（红/橙/蓝），不随主题切换变化：
 * 优先级是语义信号，跨深浅色保持一致才能形成稳定的肌肉记忆，
 * 这与 Todoist / TickTick 的 P1-P4 配色策略一致。
 */
export interface PriorityMeta {
  value: Priority;
  color: string;
  labelZh: string;
  labelEn: string;
}

// 从高到低排列，便于选择器直接 map
export const PRIORITY_META: PriorityMeta[] = [
  { value: 3, color: '#e5484d', labelZh: '高', labelEn: 'High' },
  { value: 2, color: '#f59e0b', labelZh: '中', labelEn: 'Medium' },
  { value: 1, color: '#6a9bcc', labelZh: '低', labelEn: 'Low' },
  { value: 0, color: 'var(--color-text-tertiary)', labelZh: '无', labelEn: 'None' },
];

const COLOR_BY_VALUE: Record<Priority, string> = {
  3: '#e5484d',
  2: '#f59e0b',
  1: '#6a9bcc',
  0: 'var(--color-text-tertiary)',
};

export function priorityColor(p: Priority): string {
  return COLOR_BY_VALUE[p];
}

export function priorityLabel(p: Priority, lang: 'zh' | 'en'): string {
  const meta = PRIORITY_META.find((m) => m.value === p);
  if (!meta) return '';
  return lang === 'zh' ? meta.labelZh : meta.labelEn;
}
