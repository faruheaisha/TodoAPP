/**
 * SoundscapeTool — Asha 音景（专注白噪音 + 个人音乐库）
 *
 * 上半部分：系统内置音景（8 种环境声，只读不可修改）
 * 下半部分：个人音乐库——用户导入本地音乐，标签分类管理
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CloudRain, CloudLightning, Waves, TreePine, Coffee, Flame, Droplets, AudioLines,
  Volume2, VolumeX, Music, Plus, Trash2, FileAudio, X, Pencil, Check, type LucideIcon,
} from 'lucide-react';
import { SOUND_LIBRARY, subscribeSoundscape, isMissing, type SoundDef } from '../../lib/soundscape';
import { useSoundscapeStore } from '../../store/soundscapeStore';
import { useMusicLibraryStore, type UserTrack, type MusicCategory } from '../../store/musicLibraryStore';
import { stopUserTrack } from '../../lib/musicLibrary';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

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

  // 系统音景 store
  const soundVolumes = useSoundscapeStore((s) => s.volumes);
  const masterVolume = useSoundscapeStore((s) => s.masterVolume);
  const activeSystem = useSoundscapeStore((s) => s.active);
  const toggleSystem = useSoundscapeStore((s) => s.toggleTrack);
  const setSystemVolume = useSoundscapeStore((s) => s.setVolume);
  const setSystemMaster = useSoundscapeStore((s) => s.setMaster);
  const stopAllSystem = useSoundscapeStore((s) => s.stopAllTracks);

  // 个人音乐库 store
  const userTracks = useMusicLibraryStore((s) => s.tracks);
  const categories = useMusicLibraryStore((s) => s.categories);
  const userVolumes = useMusicLibraryStore((s) => s.volumes);
  const userMasterVolume = useMusicLibraryStore((s) => s.masterVolume);
  const activeUser = useMusicLibraryStore((s) => s.active);
  const toggleUser = useMusicLibraryStore((s) => s.togglePlay);
  const setUserVol = useMusicLibraryStore((s) => s.setVolume);
  const setUserMaster = useMusicLibraryStore((s) => s.setMaster);
  const stopAllUser = useMusicLibraryStore((s) => s.stopAll);
  const addTrack = useMusicLibraryStore((s) => s.addTrack);
  const removeTrack = useMusicLibraryStore((s) => s.removeTrack);
  const updateTrackTags = useMusicLibraryStore((s) => s.updateTrackTags);
  const addCategory = useMusicLibraryStore((s) => s.addCategory);
  const removeCategory = useMusicLibraryStore((s) => s.removeCategory);
  const renameCategory = useMusicLibraryStore((s) => s.renameCategory);

  // 订阅引擎状态
  const [, bump] = useState(0);
  useEffect(() => subscribeSoundscape(() => bump((v) => v + 1)), []);

  const anyMissing = SOUND_LIBRARY.some((s) => isMissing(s.id));
  const hasUserTracks = userTracks.length > 0;

  // ── 个人音乐库状态 ──
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [renamingCat, setRenamingCat] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // 主音量同步到用户音轨
  const handleMasterChange = (v: number) => {
    setSystemMaster(v);
    setUserMaster(v);
  };

  // 导入音频文件
  const handleImport = useCallback(async () => {
    setImporting(true);
    setImportError(null);
    try {
      const files = await open({
        multiple: true,
        filters: [{
          name: t('soundscape.audioFiles'),
          extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus'],
        }],
      });
      if (!files) { setImporting(false); return; }

      const paths = Array.isArray(files) ? files : [files];
      const imported: UserTrack[] = [];

      for (const filePath of paths) {
        try {
          const destPath: string = await invoke('import_audio', { source: filePath });
          // extract name from original path
          const name = filePath.split('\\').pop()?.split('/').pop() ?? filePath;
          imported.push({
            id: 'ut_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            name,
            filePath: destPath,
            tags: selectedCategory ? [selectedCategory] : [],
            importedAt: Date.now(),
          });
        } catch (err) {
          console.warn('Import failed for', filePath, err);
        }
      }

      imported.forEach((t) => addTrack(t));
    } catch (err: any) {
      setImportError(err?.toString?.() ?? '导入失败');
    } finally {
      setImporting(false);
    }
  }, [selectedCategory, addTrack, t]);

  // 添加分类
  const handleAddCategory = () => {
    const name = newCategoryName.trim();
    if (name) {
      addCategory(name);
      setNewCategoryName('');
      setNewCategoryInput(false);
    }
  };

  // 删除分类
  const handleRemoveCategory = (cat: MusicCategory) => {
    removeCategory(cat.id);
    if (selectedCategory === cat.id) {
      setSelectedCategory(null);
    }
  };

  // 重命名分类
  const handleRenameCategory = (cat: MusicCategory) => {
    const name = renameValue.trim();
    if (name) {
      renameCategory(cat.id, name);
    }
    setRenamingCat(null);
    setRenameValue('');
  };

  // 删除曲目（含磁盘文件）
  const handleDeleteTrack = useCallback(async (track: UserTrack) => {
    if (activeUser.includes(track.id)) {
      stopUserTrack(track.id);
    }
    try {
      await invoke('delete_audio', { filePath: track.filePath });
    } catch {
      // 文件可能已被手动删除，静默忽略
    }
    removeTrack(track.id);
  }, [activeUser, removeTrack]);

  // 给曲目添加/移除标签
  const handleTrackTag = (track: UserTrack, catId: string) => {
    const has = track.tags.includes(catId);
    const newTags = has
      ? track.tags.filter((t) => t !== catId)
      : [...track.tags, catId];
    updateTrackTags(track.id, newTags);
  };

  // 过滤后的曲目
  const filteredTracks = selectedCategory
    ? userTracks.filter((t) => t.tags.includes(selectedCategory))
    : userTracks;

  // 按导入时间倒序
  filteredTracks.sort((a, b) => b.importedAt - a.importedAt);

  const allUserActive = activeUser.length > 0;

  return (
    <div className="flex flex-col" style={{ gap: '20px' }}>
      {/* ========================================
          系统音景（只读不可修改）
          ======================================== */}

      {/* ── 主音量 + 全部停止 ── */}
      <div className="flex items-center" style={{ gap: '10px' }}>
        <Volume2 size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
        <input
          type="range" min={0} max={100}
          value={Math.round(masterVolume * 100)}
          onChange={(e) => handleMasterChange(Number(e.target.value) / 100)}
          className="soundscape-slider flex-1"
          aria-label={t('soundscape.master')}
        />
        <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', width: '30px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(masterVolume * 100)}%
        </span>
        <button
          onClick={() => { stopAllSystem(); stopAllUser(); }}
          disabled={activeSystem.length === 0 && activeUser.length === 0}
          className="flex items-center transition-colors cursor-pointer"
          style={{
            gap: '4px', padding: '4px 10px', borderRadius: '6px', fontSize: '10px',
            border: '0.5px solid var(--color-border)',
            color: (activeSystem.length > 0 || activeUser.length > 0) ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)',
            backgroundColor: 'transparent',
            opacity: (activeSystem.length > 0 || activeUser.length > 0) ? 1 : 0.5,
          }}
        >
          <VolumeX size={11} />
          {t('soundscape.stopAll')}
        </button>
      </div>

      {/* ── 系统音景卡片网格 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
        {SOUND_LIBRARY.map((sound) => (
          <SoundCard
            key={sound.id}
            sound={sound}
            lang={lang}
            active={activeSystem.includes(sound.id)}
            missing={isMissing(sound.id)}
            volume={soundVolumes[sound.id] ?? 0.7}
            onToggle={() => toggleSystem(sound.id)}
            onVolume={(v) => setSystemVolume(sound.id, v)}
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
            npm run fetch-sounds
          </code>
        </div>
      )}

      <p style={{ fontSize: '9px', color: 'var(--color-text-tertiary)', opacity: 0.7 }}>
        {t('soundscape.licenseNote')}
      </p>

      {/* ═══════════════════════════════════════════════
          个人音乐库
          ═══════════════════════════════════════════════ */}
      <div style={{ borderTop: '0.5px solid var(--color-border)', paddingTop: '16px' }} />

      {/* ── 个人库标题栏 ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center" style={{ gap: '8px' }}>
          <Music size={14} style={{ color: 'var(--clay)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>
            {t('soundscape.myMusic')}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
            ({userTracks.length})
          </span>
        </div>
        <div className="flex items-center" style={{ gap: '6px' }}>
          {/* 停止所有用户曲目 */}
          {allUserActive && (
            <button
              onClick={stopAllUser}
              className="flex items-center cursor-pointer transition-colors"
              style={{
                gap: '4px', padding: '4px 10px', borderRadius: '6px', fontSize: '10px',
                border: '0.5px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                backgroundColor: 'transparent',
              }}
            >
              <VolumeX size={11} />
              {t('soundscape.stopAll')}
            </button>
          )}
        </div>
      </div>

      {/* ── 分类标签栏 ── */}
      <div className="flex items-center flex-wrap" style={{ gap: '6px' }}>
        <button
          onClick={() => setSelectedCategory(null)}
          className="cursor-pointer transition-colors"
          style={{
            padding: '4px 12px', borderRadius: '14px', fontSize: '10px',
            border: '0.5px solid ' + (selectedCategory === null ? 'var(--clay)' : 'var(--color-border)'),
            backgroundColor: selectedCategory === null ? 'var(--clay-light)' : 'transparent',
            color: selectedCategory === null ? 'var(--clay)' : 'var(--color-text-secondary)',
            fontWeight: selectedCategory === null ? 600 : 400,
          }}
        >
          {t('soundscape.all')}
        </button>
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center"
            style={{ gap: '2px' }}
          >
            {renamingCat === cat.id ? (
              <div className="flex items-center" style={{ gap: '2px' }}>
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameCategory(cat);
                    if (e.key === 'Escape') { setRenamingCat(null); }
                  }}
                  style={{
                    padding: '3px 8px', borderRadius: '14px', fontSize: '10px',
                    border: '0.5px solid var(--clay)', outline: 'none',
                    backgroundColor: 'var(--color-bg-input)',
                    color: 'var(--color-text-primary)', width: '70px',
                  }}
                />
                <button
                  onClick={() => handleRenameCategory(cat)}
                  className="cursor-pointer"
                  style={{ padding: '2px', border: 'none', background: 'none', color: 'var(--clay)' }}
                >
                  <Check size={11} />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  className="cursor-pointer transition-colors"
                  style={{
                    padding: '4px 12px', borderRadius: '14px', fontSize: '10px',
                    border: '0.5px solid ' + (selectedCategory === cat.id ? 'var(--clay)' : 'var(--color-border)'),
                    backgroundColor: selectedCategory === cat.id ? 'var(--clay-light)' : 'transparent',
                    color: selectedCategory === cat.id ? 'var(--clay)' : 'var(--color-text-secondary)',
                    fontWeight: selectedCategory === cat.id ? 600 : 400,
                  }}
                >
                  {cat.name}
                </button>
                <button
                  onClick={() => { setRenamingCat(cat.id); setRenameValue(cat.name); }}
                  className="cursor-pointer"
                  style={{ padding: '2px', border: 'none', background: 'none', color: 'var(--color-text-tertiary)', opacity: 0.6 }}
                  title={t('soundscape.rename')}
                >
                  <Pencil size={9} />
                </button>
                <button
                  onClick={() => handleRemoveCategory(cat)}
                  className="cursor-pointer"
                  style={{ padding: '2px', border: 'none', background: 'none', color: 'var(--color-text-tertiary)', opacity: 0.5 }}
                  title={t('soundscape.deleteCategory')}
                >
                  <X size={9} />
                </button>
              </>
            )}
          </div>
        ))}
        {newCategoryInput ? (
          <div className="flex items-center" style={{ gap: '2px' }}>
            <input
              autoFocus
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCategory();
                if (e.key === 'Escape') { setNewCategoryInput(false); setNewCategoryName(''); }
              }}
              placeholder={t('soundscape.categoryName')}
              style={{
                padding: '3px 8px', borderRadius: '14px', fontSize: '10px',
                border: '0.5px solid var(--clay)', outline: 'none',
                backgroundColor: 'var(--color-bg-input)',
                color: 'var(--color-text-primary)', width: '80px',
              }}
            />
            <button
              onClick={handleAddCategory}
              className="cursor-pointer"
              style={{ padding: '2px', border: 'none', background: 'none', color: 'var(--clay)' }}
            >
              <Check size={11} />
            </button>
            <button
              onClick={() => { setNewCategoryInput(false); setNewCategoryName(''); }}
              className="cursor-pointer"
              style={{ padding: '2px', border: 'none', background: 'none', color: 'var(--color-text-tertiary)' }}
            >
              <X size={11} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setNewCategoryInput(true)}
            className="flex items-center cursor-pointer transition-colors"
            style={{
              padding: '4px 10px', borderRadius: '14px', fontSize: '10px',
              border: '0.5px dashed var(--color-border)',
              backgroundColor: 'transparent', color: 'var(--color-text-tertiary)',
              gap: '3px',
            }}
          >
            <Plus size={10} />
            {t('soundscape.addCategory')}
          </button>
        )}
      </div>

      {/* ── 导入按钮 + 错误提示 ── */}
      <div className="flex items-center" style={{ gap: '10px' }}>
        <button
          onClick={handleImport}
          disabled={importing}
          className="flex items-center cursor-pointer transition-colors"
          style={{
            gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '11px',
            border: '0.5px solid var(--clay)',
            backgroundColor: 'var(--clay-light)',
            color: 'var(--clay)',
            fontWeight: 500,
            opacity: importing ? 0.6 : 1,
          }}
        >
          <FileAudio size={14} />
          {importing ? t('soundscape.importing') : t('soundscape.importMusic')}
        </button>
        <span style={{ fontSize: '9px', color: 'var(--color-text-tertiary)' }}>
          {t('soundscape.supportedFormats')}
        </span>
      </div>
      {importError && (
        <div style={{ fontSize: '10px', color: 'var(--fig)', padding: '4px 0' }}>
          {importError}
        </div>
      )}

      {/* ── 用户曲目网格 ── */}
      {hasUserTracks ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
          {filteredTracks.length > 0 ? (
            filteredTracks.map((track) => (
              <UserTrackCard
                key={track.id}
                track={track}
                lang={lang}
                categories={categories}
                active={activeUser.includes(track.id)}
                volume={userVolumes[track.id] ?? 0.7}
                onToggle={() => toggleUser(track.id, track.filePath)}
                onVolume={(v) => setUserVol(track.id, v)}
                onDelete={() => handleDeleteTrack(track)}
                onTagToggle={(catId) => handleTrackTag(track, catId)}
              />
            ))
          ) : (
            <div
              style={{
                gridColumn: '1 / -1',
                padding: '20px 0',
                textAlign: 'center',
                fontSize: '11px',
                color: 'var(--color-text-tertiary)',
              }}
            >
              {t('soundscape.noMatchFilter')}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            padding: '24px 16px', borderRadius: '10px',
            border: '0.5px dashed var(--color-border)',
            backgroundColor: 'var(--color-bg-tertiary)',
            textAlign: 'center',
          }}
        >
          <Music size={24} style={{ color: 'var(--color-text-tertiary)', marginBottom: '8px', opacity: 0.5 }} />
          <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', lineHeight: 1.6 }}>
            {t('soundscape.myMusicEmpty')}
          </div>
        </div>
      )}

      {/* License Note — 放在个人库下方 */}
      <p style={{ fontSize: '9px', color: 'var(--color-text-tertiary)', opacity: 0.7 }}>
        {t('soundscape.licenseNote')}
      </p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// 系统音景卡片（与之前相同）
// ═════════════════════════════════════════════════════════════
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

// ═════════════════════════════════════════════════════════════
// 用户曲目卡片
// ═════════════════════════════════════════════════════════════
function UserTrackCard({
  track, lang, categories, active, volume, onToggle, onVolume, onDelete, onTagToggle,
}: {
  track: UserTrack;
  lang: 'zh' | 'en';
  categories: MusicCategory[];
  active: boolean;
  volume: number;
  onToggle: () => void;
  onVolume: (v: number) => void;
  onDelete: () => void;
  onTagToggle: (catId: string) => void;
}) {
  const { t } = useTranslation();
  const [showTags, setShowTags] = useState(false);

  // 去掉文件扩展名显示
  const displayName = track.name.replace(/\.[^.]+$/, '');

  return (
    <div
      className="flex flex-col transition-all"
      style={{
        borderRadius: '10px',
        border: '0.5px solid ' + (active ? 'var(--clay)' : 'var(--color-border)'),
        backgroundColor: active ? 'var(--clay-light)' : 'var(--color-bg-tertiary)',
        padding: '10px',
        gap: '6px',
      }}
    >
      <button
        onClick={onToggle}
        className="flex flex-col items-center cursor-pointer"
        style={{ gap: '4px', border: 'none', backgroundColor: 'transparent' }}
      >
        <AudioLines
          size={20}
          strokeWidth={1.6}
          style={{ color: active ? 'var(--clay)' : 'var(--color-text-secondary)' }}
        />
        <span
          style={{
            fontSize: '11px', fontWeight: active ? 600 : 400,
            color: active ? 'var(--clay)' : 'var(--color-text-secondary)',
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
            whiteSpace: 'nowrap',
          }}
          title={displayName}
        >
          {displayName}
        </span>
      </button>

      {/* 标签 */}
      {categories.length > 0 && track.tags.length > 0 && (
        <div className="flex items-center flex-wrap" style={{ gap: '3px', justifyContent: 'center' }}>
          {track.tags.map((tagId) => {
            const cat = categories.find((c) => c.id === tagId);
            return cat ? (
              <span
                key={tagId}
                style={{
                  fontSize: '8px', padding: '1px 6px', borderRadius: '8px',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-tertiary)',
                  border: '0.5px solid var(--color-border)',
                }}
              >
                {cat.name}
              </span>
            ) : null;
          })}
        </div>
      )}

      {/* 操作区 */}
      <div className="flex items-center justify-between" style={{ gap: '4px' }}>
        {/* 标签切换按钮 */}
        {categories.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowTags(!showTags)}
              className="cursor-pointer"
              style={{
                padding: '2px 5px', borderRadius: '4px', fontSize: '8px',
                border: '0.5px solid var(--color-border)',
                backgroundColor: 'transparent',
                color: 'var(--color-text-tertiary)',
              }}
            >
              <Plus size={8} />
            </button>
            {showTags && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                  onClick={() => setShowTags(false)}
                />
                <div
                  style={{
                    position: 'absolute', bottom: '100%', left: 0, zIndex: 100,
                    padding: '6px', borderRadius: '8px',
                    backgroundColor: 'var(--color-bg-secondary)',
                    border: '0.5px solid var(--color-border)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex', flexDirection: 'column', gap: '3px',
                    minWidth: '80px',
                  }}
                >
                  {categories.map((cat) => {
                    const has = track.tags.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => { onTagToggle(cat.id); }}
                        className="cursor-pointer"
                        style={{
                          padding: '3px 8px', borderRadius: '4px', fontSize: '10px',
                          border: 'none',
                          backgroundColor: has ? 'var(--clay-light)' : 'transparent',
                          color: has ? 'var(--clay)' : 'var(--color-text-secondary)',
                          textAlign: 'left',
                        }}
                      >
                        {has ? '✓ ' : ''}{cat.name}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* 删除按钮 */}
        <button
          onClick={onDelete}
          className="cursor-pointer"
          style={{
            padding: '2px 5px', borderRadius: '4px', fontSize: '8px',
            border: '0.5px solid var(--color-border)',
            backgroundColor: 'transparent',
            color: 'var(--color-text-tertiary)',
            opacity: 0.6,
          }}
          title={t('soundscape.deleteTrack')}
        >
          <Trash2 size={8} />
        </button>
      </div>

      {/* 音量条 */}
      {active && (
        <input
          type="range" min={0} max={100}
          value={Math.round(volume * 100)}
          onChange={(e) => onVolume(Number(e.target.value) / 100)}
          className="soundscape-slider w-full"
        />
      )}
    </div>
  );
}
