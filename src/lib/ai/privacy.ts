/**
 * privacy.ts — 数据分类权威 Schema
 *
 * 定义所有数据域（Domain）及其字段级别的隐私分类。
 * 两条消费线：
 *   - contextInjector.ts：只读 publicFields 构建自动上下文
 *   - tools.ts：domain + minTier 决定工具可见性与执行权限
 *
 * 这是机器可读的单一事实源，所有模块从这里 import，不重复定义。
 */
export type Domain =
  | 'todos'
  | 'subtasks'
  | 'tags'
  | 'habits'
  | 'notes'
  | 'music'
  | 'recurrence'
  | 'navigation'
  | 'stats'
  | 'appearance'
  | 'schedule'
  | 'backup'
  | 'logs'
  | 'settings';

export const ALL_DOMAINS: Domain[] = [
  'todos', 'subtasks', 'tags', 'habits', 'notes',
  'music', 'recurrence', 'navigation', 'stats',
  'appearance', 'schedule', 'backup', 'logs', 'settings',
];

export type DataClassification = 'public' | 'tool_only' | 'sensitive' | 'restricted';

export interface DomainClassification {
  domain: Domain;
  /** 可安全注入系统提示：计数、标题、状态、名称 */
  publicFields: string[];
  /** 仅通过显式工具调用可读：全文、详细记录 */
  toolOnlyFields: string[];
  /** 模型绝对不能接触：API Key、本地路径、凭据 */
  sensitiveFields: string[];
  /** 用户 opt-in 后才暴露（未来扩展） */
  restrictedFields: string[];
  descriptionZh: string;
  descriptionEn: string;
}

export const DOMAIN_CLASSIFICATIONS: DomainClassification[] = [
  {
    domain: 'todos',
    publicFields: ['title', 'deadline', 'priority', 'completed', 'todoType', 'overdue'],
    toolOnlyFields: ['createdAt', 'sortOrder', 'reminderSent'],
    sensitiveFields: [],
    restrictedFields: [],
    descriptionZh: '任务管理（临时/长时待办）',
    descriptionEn: 'Task management (quick/long-term todos)',
  },
  {
    domain: 'subtasks',
    publicFields: ['text', 'completed'],
    toolOnlyFields: ['createdAt'],
    sensitiveFields: [],
    restrictedFields: [],
    descriptionZh: '子任务',
    descriptionEn: 'Subtasks',
  },
  {
    domain: 'tags',
    publicFields: ['name', 'color'],
    toolOnlyFields: [],
    sensitiveFields: [],
    restrictedFields: [],
    descriptionZh: '标签',
    descriptionEn: 'Tags',
  },
  {
    domain: 'habits',
    publicFields: ['name', 'color', 'frequency', 'weeklyTarget', 'streak', 'completionRate'],
    toolOnlyFields: ['checkIns', 'note', 'reminderEnabled', 'reminderTime', 'milestones'],
    sensitiveFields: [],
    restrictedFields: [],
    descriptionZh: '习惯打卡',
    descriptionEn: 'Habit tracking',
  },
  {
    domain: 'notes',
    publicFields: ['scratchpadPresence'],
    toolOnlyFields: ['scratchpad', 'todoNotes'],
    sensitiveFields: [],
    restrictedFields: [],
    descriptionZh: '笔记（随手记 + 任务笔记）',
    descriptionEn: 'Notes (scratchpad + todo notes)',
  },
  {
    domain: 'music',
    publicFields: ['trackName', 'categoryName', 'tags'],
    toolOnlyFields: ['importedAt'],
    sensitiveFields: ['filePath'],
    restrictedFields: [],
    descriptionZh: '个人音乐库',
    descriptionEn: 'Personal music library',
  },
  {
    domain: 'recurrence',
    publicFields: ['type'],
    toolOnlyFields: [],
    sensitiveFields: [],
    restrictedFields: [],
    descriptionZh: '重复规则',
    descriptionEn: 'Recurrence rules',
  },
  {
    domain: 'navigation',
    publicFields: ['toolId'],
    toolOnlyFields: [],
    sensitiveFields: [],
    restrictedFields: [],
    descriptionZh: '工具面板导航',
    descriptionEn: 'Tool panel navigation',
  },
  {
    domain: 'stats',
    publicFields: ['todoCounts', 'focusSessions', 'habitsCount'],
    toolOnlyFields: [],
    sensitiveFields: [],
    restrictedFields: [],
    descriptionZh: '效率统计',
    descriptionEn: 'Productivity statistics',
  },
  {
    domain: 'appearance',
    publicFields: ['theme', 'language', 'accentColor', 'sortMode'],
    toolOnlyFields: [],
    sensitiveFields: [],
    restrictedFields: [],
    descriptionZh: '外观偏好（主题 / 语言 / 强调色 / 排序）',
    descriptionEn: 'Appearance preferences (theme / language / accent / sort)',
  },
  {
    domain: 'schedule',
    publicFields: ['weeklyReportEnabled', 'weeklyReportTime', 'achievementTime'],
    toolOnlyFields: [],
    sensitiveFields: [],
    restrictedFields: [],
    descriptionZh: '日程偏好（周报 / 每日成就弹窗）',
    descriptionEn: 'Schedule preferences (weekly report / daily achievement)',
  },
  {
    domain: 'backup',
    publicFields: [],
    toolOnlyFields: [],
    sensitiveFields: [],
    restrictedFields: [],
    descriptionZh: '数据搬运（导出 / 云备份，每次需确认）',
    descriptionEn: 'Data transfer (export / cloud backup, confirm each time)',
  },
  {
    domain: 'logs',
    publicFields: ['provider', 'model', 'tokens', 'cost', 'status'],
    toolOnlyFields: [],
    sensitiveFields: [],
    restrictedFields: [],
    descriptionZh: '用量日志（API 调用记录 / 模型用量，只读）',
    descriptionEn: 'Usage logs (API call records / model usage, read-only)',
  },
  {
    domain: 'settings',
    publicFields: [],
    toolOnlyFields: [],
    // 永不暴露：凭据、密钥、路径、全局快捷键 —— 无任何工具映射到此域
    sensitiveFields: ['cloudBackupUrl', 'cloudBackupUser', 'cloudBackupPass', 'downloadPath', 'hotkey', 'apiKey', 'filePath'],
    restrictedFields: [],
    descriptionZh: '受保护配置（密钥 / 凭据 / 快捷键，始终拒绝模型访问）',
    descriptionEn: 'Protected config (keys / credentials / hotkey, always denied)',
  },
];
