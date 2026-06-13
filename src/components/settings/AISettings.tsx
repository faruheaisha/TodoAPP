/**
 * AISettings — CC Switch 风格 AI 供应商管理
 *
 * 三标签：供应商 / 路由 / 统计
 *  - 供应商：卡片列表，增删改，一键获取模型，测试连接
 *  - 路由：当前激活供应商 + 模型选择
 *  - 统计：近 7 天用量趋势 + 供应商明细
 */
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, ChevronRight, Check, Loader2,
  RefreshCw, Zap, BarChart2, Settings2, Sparkles,
  ExternalLink, X, Eye, EyeOff,
} from 'lucide-react';
import { useAIStore, type AIProvider, type DailyUsage } from '../../store/aiStore';
import { testConnection, fetchModels } from '../../lib/ai/client';

// ── Sub-tab types ──────────────────────────────────────────────────────
type SubTab = 'providers' | 'routing' | 'stats';

// ── Color palette for provider logos ─────────────────────────────────
const LOGO_COLORS = [
  '#D97757', '#6E9AF0', '#52B788', '#C77DFF',
  '#F4A261', '#48CAE4', '#E07A5F', '#81B29A',
];
function logoColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return LOGO_COLORS[h % LOGO_COLORS.length];
}

// ── Main component ────────────────────────────────────────────────────
export default function AISettings() {
  const { t } = useTranslation();
  const {
    aiEnabled, setAiEnabled, petVisible, setPetVisible,
    providers, activeChatProviderId,
    usageRecords,
  } = useAIStore();
  const [subTab, setSubTab] = useState<SubTab>('providers');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const editingProvider = editingId ? providers.find((p) => p.id === editingId) ?? null : null;

  return (
    <div className="flex flex-col" style={{ gap: '14px', minHeight: 0 }}>

      {/* ── 总开关行 ── */}
      <div className="flex items-center" style={{ gap: '12px', flexWrap: 'wrap' }}>
        <div
          className="flex items-center flex-1"
          style={{
            padding: '10px 14px', borderRadius: '10px',
            border: '0.5px solid ' + (aiEnabled ? 'var(--clay)' : 'var(--color-border)'),
            backgroundColor: aiEnabled ? 'var(--clay-light)' : 'var(--color-bg-tertiary)',
            gap: '10px',
          }}
        >
          <Sparkles size={14} style={{ color: aiEnabled ? 'var(--clay)' : 'var(--color-text-tertiary)', flexShrink: 0 }} />
          <div className="flex flex-col flex-1" style={{ gap: '1px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {t('ai.enableTitle')}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
              {t('ai.enableDesc')}
            </span>
          </div>
          <Switch checked={aiEnabled} onChange={setAiEnabled} />
        </div>

        {/* Asha 独立开关 */}
        <div
          className="flex items-center"
          style={{
            padding: '10px 14px', borderRadius: '10px',
            border: '0.5px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-tertiary)',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '18px', lineHeight: 1 }}>🐾</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {t('ai.petVisible', 'Asha 宠物')}
          </span>
          <Switch checked={petVisible} onChange={setPetVisible} />
        </div>
      </div>

      {/* ── 子标签栏 ── */}
      <div
        className="flex"
        style={{
          borderRadius: '8px',
          border: '0.5px solid var(--color-border)',
          backgroundColor: 'var(--color-bg-tertiary)',
          padding: '3px',
          gap: '2px',
        }}
      >
        {([
          { key: 'providers', label: t('ai.tabProviders', '供应商'), icon: <Settings2 size={12} /> },
          { key: 'routing',   label: t('ai.tabRouting', '路由'),     icon: <Zap size={12} /> },
          { key: 'stats',     label: t('ai.tabStats', '统计'),       icon: <BarChart2 size={12} /> },
        ] as { key: SubTab; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className="flex-1 flex items-center justify-center cursor-pointer transition-all"
            style={{
              gap: '5px', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
              border: 'none',
              backgroundColor: subTab === key ? 'var(--color-bg-secondary)' : 'transparent',
              color: subTab === key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              boxShadow: subTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ── Tab 内容 ── */}
      <div style={{ flex: 1, minHeight: 0 }}>

        {/* 供应商 tab */}
        {subTab === 'providers' && (
          <div className="flex flex-col" style={{ gap: '6px' }}>
            {/* 添加按钮 */}
            <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {t('ai.providers')}
              </span>
              <button
                onClick={() => { setShowAddForm(true); setEditingId(null); }}
                className="flex items-center cursor-pointer transition-colors"
                style={{
                  gap: '4px', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
                  border: '0.5px solid var(--clay)', color: 'var(--clay)',
                  backgroundColor: 'var(--clay-light)',
                }}
              >
                <Plus size={11} />{t('ai.addProvider', '添加供应商')}
              </button>
            </div>

            {providers.map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                active={p.id === activeChatProviderId}
                onEdit={() => { setEditingId(p.id); setShowAddForm(true); }}
              />
            ))}

            <p style={{ fontSize: '9px', lineHeight: 1.7, color: 'var(--color-text-tertiary)', opacity: 0.8, marginTop: '8px' }}>
              {t('ai.privacyNote')}
            </p>
          </div>
        )}

        {/* 路由 tab */}
        {subTab === 'routing' && (
          <RoutingTab providers={providers} activeChatProviderId={activeChatProviderId} />
        )}

        {/* 统计 tab */}
        {subTab === 'stats' && (
          <StatsTab usageRecords={usageRecords} providers={providers} />
        )}
      </div>

      {/* ── 添加 / 编辑 供应商 抽屉 ── */}
      <AnimatePresence>
        {showAddForm && (
          <ProviderForm
            initial={editingProvider}
            onClose={() => { setShowAddForm(false); setEditingId(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Provider Card ─────────────────────────────────────────────────────
function ProviderCard({
  provider, active, onEdit,
}: { provider: AIProvider; active: boolean; onEdit: () => void }) {
  const { t } = useTranslation();
  const { setActiveProvider } = useAIStore();
  const color = logoColor(provider.name);
  const configured = !!provider.apiKey;
  const modelLabel = provider.activeModel || provider.fetchedModels[0] || '-';

  return (
    <div
      style={{
        borderRadius: '10px',
        border: '0.5px solid ' + (active ? 'var(--clay)' : 'var(--color-border)'),
        backgroundColor: 'var(--color-bg-tertiary)',
        overflow: 'hidden',
      }}
    >
      <div className="flex items-center" style={{ padding: '10px 12px', gap: '10px' }}>
        {/* Logo */}
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 30, height: 30, borderRadius: '8px',
            backgroundColor: color,
            color: '#fff', fontSize: '13px', fontWeight: 700,
          }}
        >
          {provider.name[0]}
        </div>

        {/* Info */}
        <div className="flex flex-col flex-1" style={{ gap: '2px', minWidth: 0 }}>
          <div className="flex items-center" style={{ gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {provider.name}
            </span>
            {configured ? (
              <span style={{
                fontSize: '9px', padding: '1px 6px', borderRadius: '10px',
                backgroundColor: 'rgba(82,183,136,0.15)', color: '#52b788', fontWeight: 600,
              }}>
                {t('ai.configured')}
              </span>
            ) : (
              <span style={{
                fontSize: '9px', padding: '1px 6px', borderRadius: '10px',
                backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)',
              }}>
                {t('ai.notConfigured', '未配置')}
              </span>
            )}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {provider.baseUrl}
          </span>
          {configured && (
            <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
              {t('ai.model')}: <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>{modelLabel}</span>
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center flex-shrink-0" style={{ gap: '6px' }}>
          {/* 编辑 */}
          <button
            onClick={onEdit}
            className="flex items-center justify-center cursor-pointer transition-colors"
            style={{
              width: 26, height: 26, borderRadius: '6px',
              border: '0.5px solid var(--color-border)', backgroundColor: 'transparent',
              color: 'var(--color-text-tertiary)',
            }}
          >
            <ChevronRight size={12} />
          </button>
          {/* 激活单选 */}
          <button
            onClick={() => configured && setActiveProvider(provider.id)}
            title={t('ai.setActive')}
            disabled={!configured}
            className="flex items-center justify-center flex-shrink-0 cursor-pointer"
            style={{
              width: 18, height: 18, borderRadius: '50%',
              border: '1.5px solid ' + (active ? 'var(--clay)' : 'var(--color-checkbox-border)'),
              backgroundColor: active ? 'var(--clay)' : 'transparent',
              opacity: configured ? 1 : 0.35,
              cursor: configured ? 'pointer' : 'not-allowed',
            }}
          >
            {active && <Check size={9} strokeWidth={3} style={{ color: '#fff' }} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Provider Add/Edit Form ────────────────────────────────────────────
function ProviderForm({
  initial, onClose,
}: { initial: AIProvider | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { addProvider, updateProvider, deleteProvider } = useAIStore();
  const isEdit = !!initial;

  const [name, setName]         = useState(initial?.name ?? '');
  const [baseUrl, setBaseUrl]   = useState(initial?.baseUrl ?? '');
  const [apiKey, setApiKey]     = useState(initial?.apiKey ?? '');
  const [notes, setNotes]       = useState(initial?.notes ?? '');
  const [showKey, setShowKey]   = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>(initial?.fetchedModels ?? []);
  const [activeModel, setActiveModel]     = useState(initial?.activeModel ?? '');
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState('');
  const [testing, setTesting]   = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs: number; error?: string } | null>(null);

  const doFetchModels = useCallback(async () => {
    if (!baseUrl || !apiKey) return;
    setFetching(true); setFetchMsg('');
    const models = await fetchModels(baseUrl.replace(/\/$/, ''), apiKey);
    if (models.length > 0) {
      setFetchedModels(models);
      if (!activeModel || !models.includes(activeModel)) setActiveModel(models[0]);
      setFetchMsg(t('ai.fetchModelsOk', `已获取 ${models.length} 个模型`).replace('$n', String(models.length)));
    } else {
      setFetchMsg(t('ai.fetchModelsFail', '获取失败，请检查 URL 和 Key'));
    }
    setFetching(false);
  }, [baseUrl, apiKey, activeModel, t]);

  const doTest = useCallback(async () => {
    if (!apiKey || !activeModel) return;
    setTesting(true); setTestResult(null);
    const result = await testConnection(
      initial?.id ?? 'custom',
      activeModel,
      apiKey,
    );
    setTestResult(result);
    setTesting(false);
  }, [apiKey, activeModel, initial?.id]);

  const save = () => {
    if (!name.trim() || !baseUrl.trim()) return;
    const payload: Omit<AIProvider, 'id'> = {
      name: name.trim(),
      baseUrl: baseUrl.trim().replace(/\/$/, ''),
      apiKey,
      fetchedModels,
      activeModel: activeModel || fetchedModels[0] || '',
      enabled: true,
      kind: initial?.kind ?? 'openai',
      isPreset: initial?.isPreset ?? false,
      notes,
      consoleUrl: initial?.consoleUrl,
    };
    if (isEdit && initial) {
      updateProvider(initial.id, payload);
    } else {
      addProvider(payload);
    }
    onClose();
  };

  const del = () => {
    if (initial && !initial.isPreset) {
      deleteProvider(initial.id);
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'absolute', inset: 0, zIndex: 20,
        backgroundColor: 'var(--color-bg-secondary)',
        overflowY: 'auto',
        padding: '20px',
        borderRadius: '12px',
      }}
    >
      {/* 标题行 */}
      <div className="flex items-center justify-between" style={{ marginBottom: '18px' }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {isEdit ? t('ai.editProvider', '编辑供应商') : t('ai.addProvider', '添加供应商')}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}>
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-col" style={{ gap: '14px' }}>
        {/* 名称 */}
        <Field label={t('ai.providerName', '供应商名称')}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如 DeepSeek"
            disabled={initial?.isPreset}
            style={inputStyle}
          />
        </Field>

        {/* Base URL */}
        <Field label={t('ai.baseUrl', '请求地址 (Base URL)')}>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.deepseek.com/v1"
            disabled={initial?.isPreset}
            style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: '11px' }}
          />
          <span style={{ fontSize: '9px', color: 'var(--color-text-tertiary)', marginTop: '3px' }}>
            {t('ai.baseUrlHint', '兼容 OpenAI Chat Completions 的服务端点，不以 / 结尾')}
          </span>
        </Field>

        {/* API Key */}
        <Field label="API Key">
          <div className="flex items-center" style={{ gap: '6px' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t('ai.keyPlaceholder')}
              autoComplete="off"
              style={{ ...inputStyle, flex: 1, fontFamily: 'var(--font-mono)', fontSize: '11px' }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', flexShrink: 0 }}
            >
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </Field>

        {/* 获取模型按钮 */}
        <div className="flex items-center" style={{ gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={doFetchModels}
            disabled={!baseUrl || !apiKey || fetching}
            className="flex items-center cursor-pointer transition-colors"
            style={{
              gap: '5px', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
              border: '0.5px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)',
              opacity: (!baseUrl || !apiKey || fetching) ? 0.5 : 1,
              cursor: (!baseUrl || !apiKey || fetching) ? 'not-allowed' : 'pointer',
            }}
          >
            {fetching ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            {t('ai.fetchModels', '获取模型列表')}
          </button>
          {fetchMsg && (
            <span style={{ fontSize: '10px', color: fetchedModels.length > 0 ? 'var(--olive, #52b788)' : '#e5484d' }}>
              {fetchMsg}
            </span>
          )}
        </div>

        {/* 模型选择 */}
        {fetchedModels.length > 0 && (
          <Field label={t('ai.model')}>
            <div className="flex flex-wrap" style={{ gap: '4px' }}>
              {fetchedModels.slice(0, 20).map((m) => (
                <button
                  key={m}
                  onClick={() => setActiveModel(m)}
                  style={{
                    fontSize: '10px', padding: '3px 9px', borderRadius: '10px',
                    border: '0.5px solid ' + (activeModel === m ? 'var(--clay)' : 'var(--color-border)'),
                    backgroundColor: activeModel === m ? 'var(--clay-light)' : 'transparent',
                    color: activeModel === m ? 'var(--clay)' : 'var(--color-text-tertiary)',
                    fontFamily: 'var(--font-mono)', cursor: 'pointer',
                  }}
                >
                  {m}
                </button>
              ))}
              {fetchedModels.length > 20 && (
                <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', padding: '3px 6px' }}>
                  +{fetchedModels.length - 20} 个
                </span>
              )}
            </div>
            {/* 自定义输入 */}
            <input
              value={activeModel}
              onChange={(e) => setActiveModel(e.target.value)}
              placeholder={t('ai.customModel')}
              style={{ ...inputStyle, marginTop: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
            />
          </Field>
        )}

        {/* 备注 */}
        <Field label={t('ai.notes', '备注（可选）')}>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('ai.notesPlaceholder', '例如：公司专用账号')}
            style={inputStyle}
          />
        </Field>

        {/* 测试连接 */}
        <div className="flex items-center" style={{ gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={doTest}
            disabled={!apiKey || !activeModel || testing}
            className="flex items-center cursor-pointer"
            style={{
              gap: '5px', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
              border: 'none', backgroundColor: 'var(--color-fill)', color: 'var(--color-fill-text)',
              opacity: (!apiKey || !activeModel || testing) ? 0.5 : 1,
              cursor: (!apiKey || !activeModel || testing) ? 'not-allowed' : 'pointer',
            }}
          >
            {testing ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
            {t('ai.testConnection')}
          </button>
          {testResult && (
            <span style={{ fontSize: '10px', color: testResult.ok ? 'var(--olive, #52b788)' : '#e5484d' }}>
              {testResult.ok
                ? t('ai.testOk', { ms: testResult.latencyMs })
                : `${t('ai.testFail')}: ${(testResult.error ?? '').slice(0, 60)}`}
            </span>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between" style={{ marginTop: '8px' }}>
          {isEdit && !initial?.isPreset ? (
            <button
              onClick={del}
              className="flex items-center cursor-pointer"
              style={{
                gap: '5px', padding: '7px 12px', borderRadius: '6px', fontSize: '11px',
                border: '0.5px solid #e5484d', color: '#e5484d', backgroundColor: 'transparent',
              }}
            >
              <Trash2 size={11} />{t('ai.deleteProvider', '删除')}
            </button>
          ) : <span />}

          <div className="flex items-center" style={{ gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '7px 16px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer',
                border: '0.5px solid var(--color-border)', backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)',
              }}
            >
              {t('common.cancel', '取消')}
            </button>
            <button
              onClick={save}
              disabled={!name.trim() || !baseUrl.trim()}
              style={{
                padding: '7px 16px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                border: 'none', backgroundColor: 'var(--clay)', color: '#fff',
                opacity: (!name.trim() || !baseUrl.trim()) ? 0.5 : 1,
              }}
            >
              {t('common.save', '保存')}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Routing Tab ───────────────────────────────────────────────────────
function RoutingTab({
  providers, activeChatProviderId,
}: { providers: AIProvider[]; activeChatProviderId: string }) {
  const { t } = useTranslation();
  const { setActiveProvider, updateProvider } = useAIStore();
  const active = providers.find((p) => p.id === activeChatProviderId);
  const configured = providers.filter((p) => !!p.apiKey);

  return (
    <div className="flex flex-col" style={{ gap: '14px' }}>
      <div className="flex flex-col" style={{ gap: '6px' }}>
        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {t('ai.defaultProvider', '默认聊天供应商')}
        </span>
        {configured.length === 0 ? (
          <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
            {t('ai.noConfiguredProvider', '尚未配置任何供应商，请先在「供应商」标签填入 API Key')}
          </span>
        ) : (
          <div className="flex flex-col" style={{ gap: '4px' }}>
            {configured.map((p) => {
              const isActive = p.id === activeChatProviderId;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveProvider(p.id)}
                  className="flex items-center cursor-pointer transition-all"
                  style={{
                    gap: '10px', padding: '10px 12px', borderRadius: '10px', textAlign: 'left',
                    border: '0.5px solid ' + (isActive ? 'var(--clay)' : 'var(--color-border)'),
                    backgroundColor: isActive ? 'var(--clay-light)' : 'var(--color-bg-tertiary)',
                  }}
                >
                  <div
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 26, height: 26, borderRadius: '7px',
                      backgroundColor: logoColor(p.name), color: '#fff', fontSize: '12px', fontWeight: 700,
                    }}
                  >
                    {p.name[0]}
                  </div>
                  <div className="flex flex-col flex-1" style={{ gap: '2px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{p.name}</span>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      {p.activeModel || p.fetchedModels[0] || '-'}
                    </span>
                  </div>
                  {isActive && <Check size={14} style={{ color: 'var(--clay)', flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 当前激活模型 快速切换 */}
      {active && active.fetchedModels.length > 1 && (
        <div className="flex flex-col" style={{ gap: '6px' }}>
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {t('ai.model')}
          </span>
          <div className="flex flex-wrap" style={{ gap: '4px' }}>
            {active.fetchedModels.slice(0, 15).map((m) => (
              <button
                key={m}
                onClick={() => updateProvider(active.id, { activeModel: m })}
                style={{
                  fontSize: '10px', padding: '4px 10px', borderRadius: '10px', cursor: 'pointer',
                  border: '0.5px solid ' + (active.activeModel === m ? 'var(--clay)' : 'var(--color-border)'),
                  backgroundColor: active.activeModel === m ? 'var(--clay-light)' : 'transparent',
                  color: active.activeModel === m ? 'var(--clay)' : 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 备注 + 官网 */}
      {active?.consoleUrl && (
        <a
          href={active.consoleUrl} target="_blank" rel="noreferrer"
          className="flex items-center"
          style={{ gap: '4px', fontSize: '11px', color: 'var(--color-text-tertiary)', textDecoration: 'none' }}
        >
          <ExternalLink size={11} />
          {t('ai.getKey')} · {active.name}
        </a>
      )}
    </div>
  );
}

// ── Stats Tab ─────────────────────────────────────────────────────────
function StatsTab({
  usageRecords, providers,
}: { usageRecords: DailyUsage[]; providers: AIProvider[] }) {
  const { t } = useTranslation();

  // 近 7 天日期
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400_000);
    return d.toISOString().slice(0, 10);
  });

  const totalRequests = usageRecords.reduce((a, r) => a + r.requests, 0);
  const totalInput    = usageRecords.reduce((a, r) => a + r.inputTokens, 0);
  const totalOutput   = usageRecords.reduce((a, r) => a + r.outputTokens, 0);

  // 每日总 tokens（近 7 天）
  const dailyTokens = days.map((d) =>
    usageRecords.filter((r) => r.date === d).reduce((a, r) => a + r.inputTokens + r.outputTokens, 0)
  );
  const maxTokens = Math.max(...dailyTokens, 1);

  // 供应商明细
  const providerStats = providers
    .map((p) => {
      const recs = usageRecords.filter((r) => r.providerId === p.id);
      return {
        id: p.id,
        name: p.name,
        requests: recs.reduce((a, r) => a + r.requests, 0),
        tokens: recs.reduce((a, r) => a + r.inputTokens + r.outputTokens, 0),
      };
    })
    .filter((s) => s.requests > 0);

  const fmtN = (n: number) =>
    n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M'
    : n >= 1_000 ? (n / 1_000).toFixed(1) + 'K'
    : String(n);

  return (
    <div className="flex flex-col" style={{ gap: '16px' }}>
      {/* 汇总行 */}
      <div className="flex" style={{ gap: '8px' }}>
        {[
          { label: t('ai.statRequests', '总请求'), value: fmtN(totalRequests) },
          { label: t('ai.statInputTokens', '输入 Tokens'), value: fmtN(totalInput) },
          { label: t('ai.statOutputTokens', '输出 Tokens'), value: fmtN(totalOutput) },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col flex-1 items-center"
            style={{
              padding: '10px 8px', borderRadius: '8px',
              border: '0.5px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-tertiary)',
            }}
          >
            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
              {value}
            </span>
            <span style={{ fontSize: '9px', color: 'var(--color-text-tertiary)', marginTop: '2px', textAlign: 'center' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* 近 7 天条形图 */}
      <div className="flex flex-col" style={{ gap: '6px' }}>
        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {t('ai.statsLast7Days', '近 7 天用量趋势')}
        </span>
        <div className="flex items-end" style={{ gap: '4px', height: '64px' }}>
          {dailyTokens.map((tokens, i) => {
            const h = Math.max(4, Math.round((tokens / maxTokens) * 56));
            const label = days[i].slice(5);
            return (
              <div key={days[i]} className="flex flex-col items-center flex-1" style={{ gap: '3px' }}>
                <div
                  style={{
                    width: '100%', height: h,
                    borderRadius: '4px 4px 0 0',
                    backgroundColor: tokens > 0 ? 'var(--clay)' : 'var(--color-border)',
                    opacity: tokens > 0 ? 0.85 : 0.3,
                    transition: 'height 0.3s ease',
                  }}
                  title={`${label}: ${fmtN(tokens)} tokens`}
                />
                <span style={{ fontSize: '9px', color: 'var(--color-text-tertiary)' }}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 供应商明细 */}
      {providerStats.length > 0 && (
        <div className="flex flex-col" style={{ gap: '6px' }}>
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {t('ai.statsProviderBreakdown', '供应商明细')}
          </span>
          <div
            style={{
              borderRadius: '8px', border: '0.5px solid var(--color-border)',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                  {[t('ai.statProvider', '供应商'), t('ai.statRequests', '请求'), t('ai.statTokens', 'Tokens')].map((h) => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-tertiary)', fontSize: '10px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {providerStats.map((s, i) => (
                  <tr key={s.id} style={{ borderTop: i > 0 ? '0.5px solid var(--color-border)' : 'none' }}>
                    <td style={{ padding: '7px 10px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{s.name}</td>
                    <td style={{ padding: '7px 10px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>{fmtN(s.requests)}</td>
                    <td style={{ padding: '7px 10px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>{fmtN(s.tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalRequests === 0 && (
        <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '20px 0' }}>
          {t('ai.noUsageData', '暂无用量数据，开始 AI 对话后自动记录')}
        </span>
      )}
    </div>
  );
}

// ── 小工具 ────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col" style={{ gap: '5px' }}>
      <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '7px 10px', borderRadius: '7px', fontSize: '12px', outline: 'none',
  border: '0.5px solid var(--color-border)',
  backgroundColor: 'var(--color-bg-input, var(--color-bg-tertiary))',
  color: 'var(--color-text-primary)',
  width: '100%',
  boxSizing: 'border-box',
};

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="transition-all cursor-pointer flex-shrink-0"
      style={{
        width: 34, height: 20, borderRadius: 10,
        backgroundColor: checked ? 'var(--clay)' : 'var(--color-bg-tertiary)',
        border: '1px solid ' + (checked ? 'var(--clay)' : 'var(--color-border)'),
        position: 'relative',
      }}
    >
      <span
        style={{
          position: 'absolute', top: 2, left: checked ? 16 : 2,
          width: 14, height: 14, borderRadius: '50%',
          backgroundColor: '#fff', transition: 'left 150ms ease',
        }}
      />
    </button>
  );
}
