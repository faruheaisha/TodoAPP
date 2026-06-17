/**
 * import-utils.ts
 * Smart import helpers:
 *  - Auto-detect source format (本应用 vs 外来第三方)
 *  - Normalize/map foreign field names to Todo interface
 *  - Merge with existing todos: id-dedup + fuzzy-dedup for foreign sources
 */
import type { Todo, TodoType, Priority } from '../store/todoStore';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ImportFormat =
  | 'json-full'      // 本应用 version:1 全量备份
  | 'json-todos'     // 本应用 todos-only 数组
  | 'json-external'  // 第三方 JSON（对象数组，字段名各异）
  | 'csv-app'        // 本应用 CSV（含标准表头 ID/Title/Type/...）
  | 'csv-external';  // 第三方 CSV（字段名各异）

export interface ImportResult {
  /** Todos to actually insert (after dedup) */
  toAdd: Todo[];
  /** Count of records skipped (duplicate) */
  skipCount: number;
  /** Field name remappings applied (for UI summary) */
  mappedFields: string[];
  /** Detected format */
  format: ImportFormat;
  /** Raw full-backup payload (only for json-full, used to restore other stores) */
  fullBackup?: Record<string, unknown>;
}

// ─── Field-name mapping tables ────────────────────────────────────────────────

const TITLE_ALIASES = ['text', 'content', 'task', 'name', 'body', 'todo', 'item', 'description'];
const DEADLINE_ALIASES = ['due', 'due_date', 'duedate', 'due_at', 'end_date', 'enddate', 'deadline_at', 'expires_at', 'expiry'];
const COMPLETED_ALIASES = ['done', 'finished', 'is_completed', 'iscompleted', 'complete', 'is_done', 'isDone'];
const CREATED_ALIASES = ['created_at', 'createtime', 'createdat', 'timestamp', 'date', 'added_at', 'added'];
const PRIORITY_ALIASES = ['priority', 'importance', 'urgency', 'p'];
const TYPE_ALIASES = ['type', 'category', 'kind', 'todotype'];

/**
 * Find the first key in `obj` that matches the given alias list (case-insensitive).
 */
function findKey(obj: Record<string, unknown>, aliases: string[]): string | null {
  const keys = Object.keys(obj);
  for (const alias of aliases) {
    const found = keys.find((k) => k.toLowerCase().replace(/[\s-]/g, '') === alias.toLowerCase().replace(/[\s-]/g, ''));
    if (found) return found;
  }
  return null;
}

/**
 * Normalise a raw priority value (string or number) to Priority 0-3.
 */
function normalizePriority(raw: unknown): Priority {
  if (typeof raw === 'number') {
    const n = Math.round(raw) as Priority;
    if (n >= 0 && n <= 3) return n;
  }
  if (typeof raw === 'string') {
    const s = raw.toLowerCase().trim();
    if (s === 'high' || s === 'urgent' || s === 'p1') return 3;
    if (s === 'medium' || s === 'mid' || s === 'p2') return 2;
    if (s === 'low' || s === 'p3') return 1;
    const n = parseInt(s, 10);
    if (!isNaN(n) && n >= 0 && n <= 3) return n as Priority;
  }
  return 0;
}

/**
 * Normalise a raw completed-like value to boolean.
 */
function normalizeCompleted(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    const s = raw.toLowerCase().trim();
    return s === 'yes' || s === 'true' || s === 'done' || s === '1' || s === 'finished';
  }
  if (typeof raw === 'number') return raw === 1;
  return false;
}

/**
 * Normalise a raw todoType value.
 */
function normalizeTodoType(raw: unknown): TodoType {
  if (typeof raw === 'string') {
    const s = raw.toLowerCase().trim();
    if (s.includes('long') || s.includes('goal') || s.includes('project')) return 'longterm';
    if (s === 'longterm' || s === 'long-term' || s === 'long_term') return 'longterm';
    if (s === 'quick' || s === 'fast' || s === 'simple') return 'quick';
  }
  return 'quick';
}

/**
 * Map a raw foreign object to a Todo, recording which fields were remapped.
 * Returns { todo, remapped } where remapped is a list of "foreignKey → appKey" strings.
 */
export function normalizeExternalFields(
  raw: Record<string, unknown>,
  index: number,
): { todo: Todo; remapped: string[] } {
  const remapped: string[] = [];

  // ── title ──
  let title = '';
  const titleKey = findKey(raw, TITLE_ALIASES);
  if (raw['title'] !== undefined) {
    title = String(raw['title'] ?? '').trim();
  } else if (titleKey) {
    title = String(raw[titleKey] ?? '').trim();
    remapped.push(`${titleKey} → title`);
  }

  // ── deadline ──
  let deadline: string | null = null;
  if (raw['deadline'] !== undefined && raw['deadline']) {
    deadline = String(raw['deadline']);
  } else {
    const dlKey = findKey(raw, DEADLINE_ALIASES);
    if (dlKey && raw[dlKey]) {
      deadline = String(raw[dlKey]);
      remapped.push(`${dlKey} → deadline`);
    }
  }
  // Validate deadline is a parsable date
  if (deadline) {
    const d = new Date(deadline);
    if (isNaN(d.getTime())) deadline = null;
  }

  // ── completed ──
  let completed = false;
  if (raw['completed'] !== undefined) {
    completed = normalizeCompleted(raw['completed']);
  } else {
    const cKey = findKey(raw, COMPLETED_ALIASES);
    if (cKey !== null) {
      completed = normalizeCompleted(raw[cKey]);
      if (cKey !== 'completed') remapped.push(`${cKey} → completed`);
    }
    // Also check status=done pattern
    if (!completed && raw['status'] !== undefined) {
      const s = String(raw['status']).toLowerCase().trim();
      if (s === 'done' || s === 'completed' || s === 'finished') {
        completed = true;
        remapped.push('status → completed');
      }
    }
  }

  // ── todoType ──
  let todoType: TodoType = 'quick';
  if (raw['todoType'] !== undefined) {
    todoType = normalizeTodoType(raw['todoType']);
  } else {
    const typeKey = findKey(raw, TYPE_ALIASES);
    if (typeKey && typeKey !== 'todoType') {
      todoType = normalizeTodoType(raw[typeKey]);
      remapped.push(`${typeKey} → todoType`);
    }
  }
  // If there is a deadline and no explicit type, infer longterm
  if (deadline && raw['todoType'] === undefined && !findKey(raw, TYPE_ALIASES)) {
    todoType = 'longterm';
  }

  // ── priority ──
  let priority: Priority = 0;
  const prioKey = findKey(raw, PRIORITY_ALIASES);
  if (prioKey) {
    priority = normalizePriority(raw[prioKey]);
    if (prioKey !== 'priority') remapped.push(`${prioKey} → priority`);
  }

  // ── createdAt ──
  let createdAt = new Date().toISOString();
  if (raw['createdAt'] && !isNaN(new Date(String(raw['createdAt'])).getTime())) {
    createdAt = String(raw['createdAt']);
  } else {
    const caKey = findKey(raw, CREATED_ALIASES);
    if (caKey && raw[caKey]) {
      const d = new Date(String(raw[caKey]));
      if (!isNaN(d.getTime())) {
        createdAt = d.toISOString();
        if (caKey !== 'createdAt') remapped.push(`${caKey} → createdAt`);
      }
    }
  }

  // ── id ──
  const id = typeof raw['id'] === 'string' && raw['id'] ? raw['id'] : crypto.randomUUID();

  const todo: Todo = {
    id,
    title,
    todoType,
    deadline,
    completed,
    createdAt,
    reminderSent: false,
    priority,
    sortOrder: index,
  };

  return { todo, remapped };
}

// ─── Dedup key helpers ────────────────────────────────────────────────────────

/** Exact dedup key: lowercase trimmed title + deadline date string */
function fuzzyKey(t: Todo): string {
  const dl = t.deadline ? new Date(t.deadline).toDateString() : '';
  return `${t.title.toLowerCase().trim()}|${dl}`;
}

// ─── Merge ────────────────────────────────────────────────────────────────────

/**
 * Given a list of `incoming` todos and the `existing` todos already in the store,
 * return which ones to add (deduped) and how many were skipped.
 *
 * Dedup rules:
 * - Always: skip if same `id` already exists in existing.
 * - For foreign source: also skip if same (title+deadline) fuzzy-key exists.
 * - Never overwrite a locally-completed todo with an incoming incomplete one.
 */
export function mergeWithExisting(
  incoming: Todo[],
  existing: Todo[],
  isForeignSource: boolean,
): { toAdd: Todo[]; skipCount: number } {
  const existingIds = new Set(existing.map((t) => t.id));
  const existingFuzzyKeys = new Set(existing.map(fuzzyKey));

  const toAdd: Todo[] = [];
  let skipCount = 0;

  for (const todo of incoming) {
    if (existingIds.has(todo.id)) {
      skipCount++;
      continue;
    }
    if (isForeignSource && existingFuzzyKeys.has(fuzzyKey(todo))) {
      skipCount++;
      continue;
    }
    // Assign new ids for foreign items that happen to share an id with an existing one
    const safeTodo = existingIds.has(todo.id) ? { ...todo, id: crypto.randomUUID() } : todo;
    toAdd.push(safeTodo);
    // Add to seen sets so within-batch duplicates are also caught
    existingIds.add(safeTodo.id);
    if (isForeignSource) existingFuzzyKeys.add(fuzzyKey(safeTodo));
  }

  return { toAdd, skipCount };
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────

/** Parse a single CSV line respecting quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { result.push(current); current = ''; }
      else current += ch;
    }
  }
  result.push(current);
  return result;
}

/** Detect whether a CSV has app-standard headers */
function isAppCSV(headers: string[]): boolean {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  return normalized.includes('id') && normalized.includes('title') && normalized.includes('type');
}

function getCSVValue(row: Record<string, unknown>, candidates: string[]): string {
  for (const key of candidates) {
    const found = Object.keys(row).find((k) => k.trim().toLowerCase() === key.toLowerCase());
    if (found && row[found] !== undefined) return String(row[found] ?? '').trim();
  }
  return '';
}

/**
 * Parse CSV text into a list of Todo objects plus mapping info.
 */
function parseCSV(csv: string): { todos: Todo[]; mappedFields: string[]; isExternal: boolean } {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { todos: [], mappedFields: [], isExternal: false };

  const headers = parseCSVLine(lines[0]).map((h) => h.trim());
  const appFormat = isAppCSV(headers);
  const allMapped: string[] = [];

  const todos = lines.slice(1).map((line, i) => {
    const values = parseCSVLine(line);
    const raw: Record<string, unknown> = {};
    headers.forEach((h, idx) => { raw[h] = values[idx]?.trim() ?? ''; });

    if (appFormat) {
      // Use app-standard column names directly, while tolerating lower-case headers.
      const rawType = getCSVValue(raw, ['Type']);
      const rawCompleted = getCSVValue(raw, ['Completed']);
      const rawPriority = getCSVValue(raw, ['Priority']);
      return {
        id: getCSVValue(raw, ['ID']) || crypto.randomUUID(),
        title: getCSVValue(raw, ['Title']),
        todoType: (rawType === 'quick' || rawType === 'longterm') ? rawType : 'quick',
        deadline: getCSVValue(raw, ['Deadline']) || null,
        completed: normalizeCompleted(rawCompleted),
        createdAt: getCSVValue(raw, ['Created At', 'CreatedAt']) || new Date().toISOString(),
        reminderSent: false,
        priority: normalizePriority(rawPriority),
        sortOrder: i,
      } satisfies Todo;
    } else {
      // Foreign CSV — normalize using field-mapping table
      const { todo, remapped } = normalizeExternalFields(raw, i);
      allMapped.push(...remapped);
      return todo;
    }
  });

  // Deduplicate mapped field labels
  const uniqueMapped = [...new Set(allMapped)];

  return { todos, mappedFields: uniqueMapped, isExternal: !appFormat };
}

// ─── Main entry: parseImportFile ──────────────────────────────────────────────

/**
 * Auto-detect format and parse the file content into ImportResult.
 * Does NOT merge with existing store todos — call mergeWithExisting separately.
 *
 * @param content  Raw file text
 * @param filename Used to determine json vs csv
 */
export function parseImportFile(content: string, filename: string): ImportResult | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  // ── CSV ──
  if (ext === 'csv') {
    try {
      const { todos, mappedFields, isExternal } = parseCSV(content);
      if (todos.length === 0) return null;
      return {
        toAdd: todos, // caller must run mergeWithExisting
        skipCount: 0,
        mappedFields,
        format: isExternal ? 'csv-external' : 'csv-app',
      };
    } catch {
      return null;
    }
  }

  // ── JSON ──
  if (ext === 'json') {
    try {
      const raw = JSON.parse(content) as Record<string, unknown>;

      // Full-backup format
      if (raw.version === 1 && Array.isArray(raw.todos)) {
        const todos: Todo[] = (raw.todos as any[]).map((it, i) => ({
          ...it,
          priority: typeof it.priority === 'number' ? it.priority : 0,
          sortOrder: typeof it.sortOrder === 'number' ? it.sortOrder : i + 1,
        }));
        return {
          toAdd: todos,
          skipCount: 0,
          mappedFields: [],
          format: 'json-full',
          fullBackup: raw,
        };
      }

      // Todos-only array (本应用旧格式)
      const arr = Array.isArray(raw) ? raw : Array.isArray(raw['todos']) ? (raw['todos'] as any[]) : null;
      if (arr && arr.length > 0) {
        // Heuristic: app format has id + todoType fields; foreign may not
        const isForeign = arr.some((it: any) => it.todoType === undefined && it.id === undefined);
        if (!isForeign) {
          const todos: Todo[] = arr.map((it: any, i: number) => ({
            ...it,
            priority: typeof it.priority === 'number' ? it.priority : 0,
            sortOrder: typeof it.sortOrder === 'number' ? it.sortOrder : i + 1,
          }));
          return { toAdd: todos, skipCount: 0, mappedFields: [], format: 'json-todos' };
        } else {
          // External JSON array
          const allMapped: string[] = [];
          const todos = arr.map((it: any, i: number) => {
            const { todo, remapped } = normalizeExternalFields(it as Record<string, unknown>, i);
            allMapped.push(...remapped);
            return todo;
          });
          return {
            toAdd: todos,
            skipCount: 0,
            mappedFields: [...new Set(allMapped)],
            format: 'json-external',
          };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  return null;
}
