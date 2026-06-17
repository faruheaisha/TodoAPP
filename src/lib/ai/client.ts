/**
 * client.ts — 统一 LLM 客户端
 *
 * 一个 chat() 覆盖全部厂商：
 *  - kind='openai'    → OpenAI Chat Completions 兼容端点（7 家）
 *  - kind='anthropic' → Claude 原生 Messages API
 *
 * 网络通道：Tauri 环境用 @tauri-apps/plugin-http 的 fetch
 * （绕过 WebView CORS，受 capabilities 域名白名单约束），
 * 浏览器/PWA 环境回退 window.fetch。
 *
 * 流式：SSE 解析；响应体不可流式读取时自动回退非流式（不报错）。
 * 工具调用（cowork 模式）：携带 tools 时强制非流式，统一抽取 toolCalls。
 */
import { getProvider } from './providers';
import { useUsageStore } from '../../store/usageStore';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** role='tool' 时对应的调用 id（OpenAI 格式） */
  toolCallId?: string;
  /** role='assistant' 发起过的工具调用（回传历史用） */
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  /** JSON 字符串参数 */
  arguments: string;
}

/** OpenAI function 格式的工具声明（Anthropic 侧自动转换） */
export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatOptions {
  providerId: string;
  /** 可直接传 baseUrl，跳过 PROVIDERS 查表（自定义供应商用） */
  baseUrl?: string;
  /** 默认 'openai'；Anthropic 原生 API 传 'anthropic' */
  kind?: 'openai' | 'anthropic';
  model: string;
  apiKey: string;
  stream?: boolean;
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  /** 要求模型输出 JSON（任务拆解用） */
  jsonMode?: boolean;
  tools?: ToolDef[];
  /** 使用来源标签（默认 '聊天'） */
  source?: string;
}

export interface ChatResult {
  text: string;
  toolCalls: ToolCall[];
  usage?: { inputTokens: number; outputTokens: number; cachedTokens: number };
  /** 实际 HTTP 响应状态码 */
  status?: number;
}

// ── fetch 通道选择 ─────────────────────────────────────────────────────

async function pickFetch(): Promise<typeof fetch> {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
      return tauriFetch as unknown as typeof fetch;
    } catch {
      /* 插件不可用则回退 */
    }
  }
  return fetch;
}

// ── 入口 ──────────────────────────────────────────────────────────────

export async function chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult> {
  if (!opts.apiKey) throw new Error('NO_API_KEY');

  // baseUrl/kind 可由调用方直传（自定义供应商），否则从 PROVIDERS 查表
  const provider = getProvider(opts.providerId);
  const baseUrl = opts.baseUrl ?? provider?.baseUrl ?? '';
  const kind: 'openai' | 'anthropic' = opts.kind ?? provider?.kind ?? 'openai';
  if (!baseUrl) throw new Error(`Unknown provider: ${opts.providerId}`);

  // 工具调用回合统一走非流式
  const wantStream = !!opts.stream && !opts.tools;

  const startTime = Date.now();
  let result: ChatResult = { text: '', toolCalls: [] };
  let httpStatus = 200;

  try {
    result = kind === 'anthropic'
      ? await chatAnthropic(baseUrl, messages, opts, wantStream)
      : await chatOpenAI(baseUrl, messages, opts, wantStream);
    httpStatus = result.status ?? 200;
  } catch (e) {
    httpStatus = extractHttpStatus(e);
    throw e;
  } finally {
    // 埋点：将真实消耗记录到 usageStore（无论成功失败，包括 401/429/500）
    try {
      const u = result.usage;
      const inputTokens  = u?.inputTokens  ?? 0;
      const outputTokens = u?.outputTokens ?? 0;
      const cachedTokens = u?.cachedTokens ?? 0;
      const dur = (Date.now() - startTime) / 1000;
      useUsageStore.getState().record({
        ts: Date.now(),
        providerId: opts.providerId,
        model: opts.model,
        source: opts.source || '聊天',
        input: inputTokens,
        output: outputTokens,
        cacheRead: cachedTokens,
        cacheWrite: 0,
        status: httpStatus,
        ttfb: 0,
        dur,
      });
    } catch { /* 埋点失败不影响正常流程 */ }
  }

  return result!;
}

/** 从 GET /v1/models 获取模型列表；失败返回空数组 */
export async function fetchModels(baseUrl: string, apiKey: string): Promise<string[]> {
  try {
    const doFetch = await pickFetch();
    const res = await doFetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items: { id?: string }[] = data?.data ?? [];
    return items.map((m) => m.id ?? m).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

/** 测试连接：发最小请求，返回延迟或错误信息 */
export async function testConnection(
  providerId: string, model: string, apiKey: string, baseUrl?: string, kind?: 'openai' | 'anthropic'
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await chat(
      [{ role: 'user', content: 'ping' }],
      { providerId, model, apiKey, baseUrl, kind, maxTokens: 8, signal: AbortSignal.timeout(15000) }
    );
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: errorMessage(e) };
  }
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/** 从 Error 消息中提取 HTTP 状态码（如 "HTTP 401: ..." → 401） */
function extractHttpStatus(e: unknown): number {
  if (e instanceof Error) {
    const m = e.message;
    const match = m.match(/^HTTP (\d{3})/);
    if (match) return parseInt(match[1], 10);
  }
  return 0;
}

// ── OpenAI 兼容实现 ────────────────────────────────────────────────────

async function chatOpenAI(
  baseUrl: string, messages: ChatMessage[], opts: ChatOptions, wantStream: boolean
): Promise<ChatResult> {
  const doFetch = await pickFetch();

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: messages.map((m) => {
      if (m.role === 'tool') {
        return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id, type: 'function',
            function: { name: tc.name, arguments: tc.arguments },
          })),
        };
      }
      return { role: m.role, content: m.content };
    }),
    stream: wantStream,
  };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens;
  if (opts.jsonMode) body.response_format = { type: 'json_object' };
  if (opts.tools?.length) {
    body.tools = opts.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

  const res = await doFetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) throw new Error(await httpError(res));

  if (wantStream && res.body && typeof res.body.getReader === 'function') {
    let usage: { inputTokens: number; outputTokens: number; cachedTokens: number } | undefined;
    const text = await readSSE(res.body, (json) => {
      const delta = json?.choices?.[0]?.delta?.content;
      // capture usage from final chunk (OpenAI sends usage in the last chunk)
      if (json?.usage && typeof json.usage === 'object') {
        usage = {
          inputTokens: (json.usage as Record<string, number>).prompt_tokens ?? 0,
          outputTokens: (json.usage as Record<string, number>).completion_tokens ?? 0,
          cachedTokens: (json.usage as Record<string, number>).prompt_cache_hit_tokens ?? (json.usage as Record<string, number>).cached_tokens ?? 0,
        };
      }
      return typeof delta === 'string' ? delta : '';
    }, opts.onDelta);
    return { text, toolCalls: [], usage, status: 200 };
  }

  const data = await res.json();
  const choice = data?.choices?.[0];
  const text: string = choice?.message?.content ?? '';
  const toolCalls: ToolCall[] = (choice?.message?.tool_calls ?? []).map(
    (tc: { id: string; function: { name: string; arguments: string } }) => ({
      id: tc.id, name: tc.function.name, arguments: tc.function.arguments,
    })
  );
  const usage = data?.usage
    ? {
        inputTokens: data.usage.prompt_tokens ?? 0,
        outputTokens: data.usage.completion_tokens ?? 0,
        cachedTokens: data.usage.prompt_cache_hit_tokens ?? data.usage.cached_tokens ?? 0,
      }
    : undefined;
  if (wantStream && opts.onDelta && text) opts.onDelta(text);
  return { text, toolCalls, usage, status: 200 };
}

// ── Anthropic Messages 实现 ────────────────────────────────────────────

async function chatAnthropic(
  baseUrl: string, messages: ChatMessage[], opts: ChatOptions, wantStream: boolean
): Promise<ChatResult> {
  const doFetch = await pickFetch();

  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const turns: Record<string, unknown>[] = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    if (m.role === 'tool') {
      turns.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }],
      });
    } else if (m.role === 'assistant' && m.toolCalls?.length) {
      const blocks: Record<string, unknown>[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const tc of m.toolCalls) {
        blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: safeParse(tc.arguments) });
      }
      turns.push({ role: 'assistant', content: blocks });
    } else {
      turns.push({ role: m.role, content: m.content });
    }
  }

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: turns,
    max_tokens: opts.maxTokens ?? 2048,
    stream: wantStream,
  };
  if (system) body.system = system;
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.tools?.length) {
    body.tools = opts.tools.map((t) => ({
      name: t.name, description: t.description, input_schema: t.parameters,
    }));
  }

  const res = await doFetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) throw new Error(await httpError(res));

  if (wantStream && res.body && typeof res.body.getReader === 'function') {
    let usage: { inputTokens: number; outputTokens: number; cachedTokens: number } | undefined;
    const text = await readSSE(res.body, (json) => {
      if (json?.type === 'content_block_delta' && json?.delta?.type === 'text_delta') {
        return json.delta.text as string;
      }
      // Anthropic message_start carries input token usage
      if (json?.type === 'message_start' && json?.message?.usage && typeof json.message.usage === 'object') {
        const u = json.message.usage as Record<string, number>;
        usage = {
          inputTokens: u.input_tokens ?? 0,
          outputTokens: u.output_tokens ?? 0,
          cachedTokens: u.cache_read_input_tokens ?? u.cache_creation_input_tokens ?? 0,
        };
      }
      // Anthropic message_delta carries final output token usage
      if (json?.type === 'message_delta' && json?.usage && typeof json.usage === 'object') {
        const u = json.usage as Record<string, number>;
        usage = {
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: u.output_tokens ?? 0,
          cachedTokens: usage?.cachedTokens ?? 0,
        };
      }
      return '';
    }, opts.onDelta);
    return { text, toolCalls: [], usage, status: 200 };
  }

  // Anthropic non-streaming
  const data = await res.json();
  let text = '';
  const toolCalls: ToolCall[] = [];
  for (const block of data?.content ?? []) {
    if (block.type === 'text') text += block.text;
    if (block.type === 'tool_use') {
      toolCalls.push({ id: block.id, name: block.name, arguments: JSON.stringify(block.input ?? {}) });
    }
  }
  const usage = data?.usage
    ? {
        inputTokens: data.usage.input_tokens ?? 0,
        outputTokens: data.usage.output_tokens ?? 0,
        cachedTokens: data.usage.cache_read_input_tokens ?? 0,
      }
    : undefined;
  if (wantStream && opts.onDelta && text) opts.onDelta(text);
  return { text, toolCalls, usage, status: 200 };
}

// ── 公共工具 ──────────────────────────────────────────────────────────

async function readSSE(
  body: ReadableStream<Uint8Array>,
  extract: (json: Record<string, unknown> & { [k: string]: any }) => string,
  onDelta?: (text: string) => void
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const piece = extract(JSON.parse(payload));
          if (piece) {
            full += piece;
            onDelta?.(piece);
          }
        } catch { /* 忽略不完整 JSON 行 */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return full;
}

async function httpError(res: Response): Promise<string> {
  let detail = '';
  try {
    const data = await res.json();
    detail = data?.error?.message ?? data?.message ?? JSON.stringify(data).slice(0, 200);
  } catch { /* 无 JSON 体 */ }
  return `HTTP ${res.status}${detail ? `: ${detail}` : ''}`;
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return {}; }
}
