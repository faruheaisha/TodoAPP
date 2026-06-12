/**
 * SoundscapeTool — Asha 音景（专注白噪音）
 *
 * 设计参照 TickTick 专注白噪音 + Noisli 混音器的交互模式：
 * 卡片网格，点卡片启停，启用后露出音量条，多轨可叠加混音。
 * 真实录音资源（Pixabay License / CC0），非程序化合成。
 * 音频文件缺失时显示「未安装」并指引运行下载脚本。
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CloudRain, CloudLightning, Waves, TreePine, Coffee, Flame, Droplets, AudioLines,
  Volume2, VolumeX, type LucideIcon,
} from 'lucide-react';
import { SOUND_LIBRARY, subscribeSoundscape, isMissing, type SoundDef } from '../../lib/soundscape';
import { useSoundscapeStore } from '../../store/soundscapeStore';

const ICONS: Record<string, LucideIcon> = {
  rain: CloudRain,
  thunder: CloudLightning,
  ocean: Waves,
  forest: TreePine,
  cafe: Coffee,
  fire: Flame,
  stream: Droplets,
  white: AudioLines,
};

export function SoundscapeTool() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const { volumes, masterVolume, active, toggleTrack, setVolume, setMaster, stopAllTracks } = useSoundscapeStore();

  // 订阅引擎状态（文件缺失检测）触发重渲
  const [, bump] = useState(0);
  useEffect(() => subscribeSoundscape(() => bump((v) => v + 1)), []);

  const anyMissing = SOUND_LIBRARY.some((s) => isMissing(s.id));

  return (
    <div className="flex flex-col" style={{ gap: '16px' }}>
      {/* 主音量 + 全部停止 */}
      <div className="flex items-center" style={{ gap: '10px' }}>
        <Volume2 size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
        <input
          type="range" min={0} max={100}
          value={Math.round(masterVolume * 100)}
          onChange={(e) => setMaster(Number(e.target.value) / 100)}
          className="soundscape-slider flex-1"
          aria-label={t('soundscape.master')}
        />
        <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', width: '30px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(masterVolume * 100)}%
        </span>
        <button
          onClick={stopAllTracks}
          disabled={active.length === 0}
          className="flex items-center transition-colors cursor-pointer"
          style={{
            gap: '4px', padding: '4px 10px', borderRadius: '6px', fontSize: '10px',
            border: '0.5px solid var(--color-border)',
            color: active.length > 0 ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)',
            backgroundColor: 'transparent',
            opacity: active.length > 0 ? 1 : 0.5,
          }}
        >
          <VolumeX size={11} />
          {t('soundscape.stopAll')}
        </button>
      </div>

      {/* 音景卡片网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
        {SOUND_LIBRARY.map((sound) => (
          <SoundCard
            key={sound.id}
            sound={sound}
            lang={lang}
            active={active.includes(sound.id)}
            missing={isMissing(sound.id)}
            volume={volumes[sound.id] ?? 0.7}
            onToggle={() => toggleTrack(sound.id)}
            onVolume={(v) => setVolume(sound.id, v)}
          />
        ))}
      </div>

      {/* 文件缺失指引 */}
      {anyMissing && (
        <div
          style={{
            padding: '10px 12px', borderRadius: '8px',
            border: '0.5px dashed var(--color-border)',
            backgroundColor: 'var(--color-bg-tertiary)',
            fontSize: '10px', lineHeight: 1.7, color: 'var(--color-text-tertiary)',
          }}
        >
          {t('soundscape.missingHint')}
          <code style={{ display: 'block', marginTop: '4px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
            node scripts/fetch-sounds.mjs
          </code>
        </div>
      )}

      <p style={{ fontSize: '9px', color: 'var(--color-text-tertiary)', opacity: 0.7 }}>
        {t('soundscape.licenseNote')}
      </p>
    </div>
  );
}

function SoundCard({
  sound, lang, active, missing, volume, onToggle, onVolume,
}: {
  sound: SoundDef;
  lang: 'zh' | 'en';
  active: boolean;
  missing: boolean;
  volume: number;
  onToggle: () => void;
  onVolume: (v: number) => void;
}) {
  const { t } = useTranslation();
  const Icon = ICONS[sound.id] ?? AudioLines;
  return (
    <div
      className="flex flex-col transition-all"
      style={{
        borderRadius: '10px',
        border: '0.5px solid ' + (active ? 'var(--clay)' : 'var(--color-border)'),
        backgroundColor: active ? 'var(--clay-light)' : 'var(--color-bg-tertiary)',
        padding: '10px',
        gap: '8px',
        opacity: missing ? 0.55 : 1,
      }}
    >
      <button
        onClick={missing ? undefined : onToggle}
        className="flex flex-col items-center cursor-pointer"
        style={{ gap: '6px', border: 'none', backgroundColor: 'transparent', cursor: missing ? 'not-allowed' : 'pointer' }}
        title={missing ? t('soundscape.missing') : (lang === 'zh' ? sound.labelZh : sound.labelEn)}
      >
        <Icon
          size={20}
          strokeWidth={1.6}
          style={{ color: active ? 'var(--clay)' : 'var(--color-text-secondary)' }}
        />
        <span style={{ fontSize: '11px', fontWeight: active ? 600 : 400, color: active ? 'var(--clay)' : 'var(--color-text-secondary)' }}>
          {lang === 'zh' ? sound.labelZh : sound.labelEn}
        </span>
        {missing && (
          <span style={{ fontSize: '8px', color: 'var(--color-text-tertiary)' }}>
            {t('soundscape.missing')}
          </span>
        )}
      </button>
      {active && !missing && (
        <input
          type="range" min={0} max={100}
          value={Math.round(volume * 100)}
          onChange={(e) => onVolume(Number(e.target.value) / 100)}
          className="soundscape-slider w-full"
          aria-label={lang === 'zh' ? sound.labelZh : sound.labelEn}
        />
      )}
    </div>
  );
}
