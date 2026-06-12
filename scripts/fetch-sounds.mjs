#!/usr/bin/env node
/**
 * fetch-sounds.mjs — Asha 音景资源获取脚本
 *
 * 用法：node scripts/fetch-sounds.mjs
 *
 * 由于音频文件较大（约 10MB）且需人工甄选音质，本脚本采用「清单引导 + 校验」模式：
 *   1. 打印每个音景的推荐来源页面（Pixabay，许可证允许商业打包分发）
 *   2. 你从页面下载喜欢的版本，重命名为清单中的文件名，放入 public/sounds/
 *   3. 再次运行本脚本校验文件是否齐全
 *
 * 为什么不全自动下载：Pixabay 的音频 CDN 直链不稳定（带哈希、会轮换），
 * 且音质需要人耳挑选（同一关键词下质量参差）。一次人工甄选 + 永久入库
 * 比脆弱的自动化更可靠。文件入库后请同步更新 public/sounds/LICENSES.md。
 */
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const soundsDir = join(root, 'public', 'sounds');

// 与 src/lib/soundscape.ts 的 SOUND_LIBRARY 保持一致
const MANIFEST = [
  { file: 'rain.mp3',    name: '雨声 Rain',          search: 'https://pixabay.com/sound-effects/search/rain%20loop/' },
  { file: 'thunder.mp3', name: '雷雨 Thunder',       search: 'https://pixabay.com/sound-effects/search/thunderstorm/' },
  { file: 'ocean.mp3',   name: '海浪 Ocean',         search: 'https://pixabay.com/sound-effects/search/ocean%20waves%20loop/' },
  { file: 'forest.mp3',  name: '森林鸟鸣 Forest',     search: 'https://pixabay.com/sound-effects/search/forest%20birds/' },
  { file: 'cafe.mp3',    name: '咖啡馆 Café',        search: 'https://pixabay.com/sound-effects/search/coffee%20shop%20ambience/' },
  { file: 'fire.mp3',    name: '篝火 Fireplace',     search: 'https://pixabay.com/sound-effects/search/fireplace%20crackling/' },
  { file: 'stream.mp3',  name: '溪流 Stream',        search: 'https://pixabay.com/sound-effects/search/creek%20stream/' },
  { file: 'white.mp3',   name: '白噪音 White Noise', search: 'https://pixabay.com/sound-effects/search/white%20noise/' },
];

console.log('\n🎧 Asha 音景资源校验\n');

let missing = 0;
for (const item of MANIFEST) {
  const path = join(soundsDir, item.file);
  if (existsSync(path)) {
    const kb = Math.round(statSync(path).size / 1024);
    console.log(`  ✅ ${item.file.padEnd(14)} ${item.name}（${kb} KB）`);
  } else {
    missing++;
    console.log(`  ❌ ${item.file.padEnd(14)} ${item.name}`);
    console.log(`     → 挑选下载：${item.search}`);
  }
}

if (missing === 0) {
  console.log('\n全部就绪 ✨ 请确认 public/sounds/LICENSES.md 已逐条记录来源。\n');
} else {
  console.log(`\n缺 ${missing} 个文件。从上方链接挑选高质量循环音（建议 1-3 分钟、128kbps MP3），`);
  console.log('下载后重命名为对应文件名放入 public/sounds/，再运行本脚本校验。');
  console.log('挑选标准：无突兀剪辑点、可无缝循环、无人声水印。\n');
  console.log('许可证说明：Pixabay Content License 允许免署名商业使用与打包分发');
  console.log('（https://pixabay.com/service/license-summary/）。\n');
  process.exitCode = 1;
}
