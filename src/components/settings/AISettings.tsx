/**
 * AISettings — AI 实验室设置页
 *
 * 交互对标 cc-switch（开源多厂商切换器）的供应商卡片模式：
 * 卡片列表 → 点击展开配置（key / 模型 / 测试连接）→ 单选激活。
 * aiEnabled 总开关承载「自我升级」体验：开启后主界面出现
 * Asha 宠物与 AI 拆解入口，关闭则 app 退回纯本地待办工具。
 *
 * 隐私：key 仅存本机；请求直连所选厂商（域名白名单见 capabilities）。
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Loader2, ExternalLink, Sparkles } from 'lucide-react';
import { PROVIDERS, type ProviderDef } from '../../lib/ai/providers';
import { testConnection } from '../../lib/ai/client';
import { useAIStore } from '../../store/aiStore';

export default function AISettings() {
  const { t } = useTranslation();
  const { aiEnabled, setAiEnabled, configs, activeProviderId, setActiveProvider } = useAIStore();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="flex flex-col" style={{ gap: '14px' }}>
      {/* 总开关 */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: '12px 14px', borderRadius: '10px',
          border: '0.5px solid ' + (aiEnabled ? 'var(--clay)' : 'var(--color-border)'),
          backgroundColor: aiEnabled ? 'var(--clay-light)' : 'var(--color-bg-tertiary)',
        }}
      >
        <div className="flex items-center" style={{ gap: '8px' }}>
          <Sparkles size={14} style={{ color: aiEnabled ? 'var(--clay)' : 'var(--color-text-tertiary)' }} />
          <div className="flex flex-col">
            <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {t('ai.enableTitle')}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
              {t('ai.enableDesc')}
            </span>
          </div>
        </div>
        <Switch checked={aiEnabled} onChange={setAiEnabled} />
      </div>

      {/* 厂商卡片列表 */}
      <div className="flex flex-col" style={{ gap: '6px', opacity: aiEnabled ? 1 : 0.5, pointerEvents: aiEnabled ? 'auto' : 'none' }}>
        <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
          {t('ai.providers')}
        </span>
        {PROVIDERS.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            configured={!!configs[p.id]?.apiKey}
            active={activeProviderId === p.id}
            expanded={expanded === p.id}
            onToggleExpand={() => setExpanded(expanded === p.id ? null : p.id)}
            onActivate={() => setActiveProvider(p.id)}
          />
        ))}
      </div>

      <p style={{ fontSize: '9px', lineHeight: 1.7, color: 'var(--color-text-tertiary)', opacity: 0.8 }}>
        {t('ai.privacyNote')}
      </p>
    </div>
  );
}

function ProviderCard({
  provider, configured, active, expanded, onToggleExpand, onActivate,
}: {
  provider: ProviderDef;
  configured: boolean;
  active: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onActivate: () => void;
}) {
  const { t } = useTranslation();
  const { configs, setProviderConfig } = useAIStore();
  const cfg = configs[provider.id] ?? { apiKey: '', model: provider.presetModels[0] };
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs: number; error?: string } | null>(null);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    const model = cfg.model || provider.presetModels[0];
    const result = await testConnection(provider.id, model, cfg.apiKey);
    setTestResult(result);
    setTesting(false);
  };

  return (
    <div
      style={{
        borderRadius: '10px',
        border: '0.5px solid ' + (active ? 'var(--clay)' : 'var(--color-border)'),
        backgroundColor: 'var(--color-bg-tertiary)',
        overflow: 'hidden',
      }}
    >
      {/* 卡片头 */}
      <div className="flex items-center" style={{ padding: '9px 12px', gap: '10px' }}>
        {/* 字母 logo 块 */}
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: '26px', height: '26px', borderRadius: '7px',
            backgroundColor: active ? 'var(--clay)' : 'var(--color-fill)',
            color: 'var(--color-fill-text)',
            fontSize: '12px', fontWeight: 700,
          }}
        >
          {provider.name[0]}
        </div>
        <button onClick={onToggleExpand} className="flex-1 flex items-center text-left cursor-pointer" style={{ gap: '6px', border: 'none', background: 'transparent', minWidth: 0 }}>
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {provider.name}
          </span>
          {configured && (
            <span className="flex items-center" style={{ gap: '3px', fontSize: '9px', color: 'var(--olive)' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--olive)' }} />
              {t('ai.configured')}
            </span>
          )}
          <ChevronDown size={11} style={{ marginLeft: 'auto', color: 'var(--color-text-tertiary)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform var(--transition-fast)', flexShrink: 0 }} />
        </button>
        {/* 激活单选 */}
        <button
          onClick={onActivate}
          disabled={!configured}
          title={t('ai.setActive')}
          className="flex items-center justify-center flex-shrink-0 cursor-pointer"
          style={{
            width: '16px', height: '16px', borderRadius: '50%',
            border: '1.5px solid ' + (active ? 'var(--clay)' : 'var(--color-checkbox-border)'),
            backgroundColor: active ? 'var(--clay)' : 'transparent',
            opacity: configured ? 1 : 0.4,
            cursor: configured ? 'pointer' : 'not-allowed',
          }}
        >
          {active && <Check size={9} strokeWidth={3} style={{ color: 'var(--ivory-light, #fff)' }} />}
        </button>
      </div>

      {/* 展开配置区 */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="flex flex-col" style={{ padding: '4px 12px 12px', gap: '8px', borderTop: '0.5px solid var(--color-separator)' }}>
              {/* API Key */}
              <label className="flex flex-col" style={{ gap: '4px', marginTop: '8px' }}>
                <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>API Key</span>
                <input
                  type="password"
                  value={cfg.apiKey}
                  onChange={(e) => setProviderConfig(provider.id, { apiKey: e.target.value })}
                  placeholder={t('ai.keyPlaceholder')}
                  autoComplete="off"
                  className="text-xs outline-none"
                  style={{
                    padding: '6px 9px', borderRadius: '6px',
                    border: '0.5px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-input)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              </label>

              {/* 模型 */}
              <div className="flex flex-col" style={{ gap: '4px' }}>
                <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>{t('ai.model')}</span>
                <div className="flex flex-wrap items-center" style={{ gap: '4px' }}>
                  {provider.presetModels.map((m) => (
                    <button
                      key={m}
                      onClick={() => setProviderConfig(provider.id, { model: m })}
                      className="cursor-pointer transition-colors"
                      style={{
                        fontSize: '10px', padding: '3px 9px', borderRadius: '10px',
                        border: '0.5px solid ' + (cfg.model === m ? 'var(--clay)' : 'var(--color-border)'),
                        backgroundColor: cfg.model === m ? 'var(--clay-light)' : 'transparent',
                        color: cfg.model === m ? 'var(--clay)' : 'var(--color-text-tertiary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {m}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={cfg.model}
                    onChange={(e) => setProviderConfig(provider.id, { model: e.target.value })}
                    placeholder={t('ai.customModel')}
                    className="text-[10px] outline-none flex-1"
                    style={{
                      minWidth: '110px', padding: '4px 8px', borderRadius: '6px',
                      border: '0.5px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-input)',
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>
              </div>

              {/* 测试连接 + 控制台链接 */}
              <div className="flex items-center" style={{ gap: '8px' }}>
                <button
                  onClick={runTest}
                  disabled={!cfg.apiKey || testing}
                  className="flex items-center cursor-pointer transition-colors"
                  style={{
                    gap: '5px', padding: '5px 12px', borderRadius: '6px', fontSize: '10px', fontWeight: 500,
                    border: 'none',
                    backgroundColor: 'var(--color-fill)',
                    color: 'var(--color-fill-text)',
                    opacity: !cfg.apiKey || testing ? 0.5 : 1,
                    cursor: !cfg.apiKey || testing ? 'not-allowed' : 'pointer',
                  }}
                >
                  {testing ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  {t('ai.testConnection')}
                </button>
                {testResult && (
                  <span style={{ fontSize: '10px', color: testResult.ok ? 'var(--olive)' : '#e5484d' }}>
                    {testResult.ok
                      ? t('ai.testOk', { ms: testResult.latencyMs })
                      : `${t('ai.testFail')}: ${truncate(testResult.error ?? '', 60)}`}
                  </span>
                )}
                <a
                  href={provider.consoleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center ml-auto"
                  style={{ gap: '3px', fontSize: '9px', color: 'var(--color-text-tertiary)', textDecoration: 'none', flexShrink: 0 }}
                >
                  {t('ai.getKey')}
                  <ExternalLink size={9} />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="transition-all cursor-pointer flex-shrink-0"
      style={{
        width: '34px', height: '20px', borderRadius: '10px',
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

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
