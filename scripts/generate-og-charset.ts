// OGP画像用フォントのサブセット文字集合(charset.txt)を src/lib/og/text.ts から生成する。
// 使い方: npx -y tsx scripts/generate-og-charset.ts
// 続きの手順(フォント本体の再生成)は src/app/api/og/fonts/README.md を参照。

import { writeFileSync } from 'node:fs';
import { OG_CHARSET } from '../src/lib/og/text';

const out = new URL('../src/app/api/og/fonts/charset.txt', import.meta.url);
writeFileSync(out, OG_CHARSET);
console.log(`wrote ${OG_CHARSET.length} chars -> ${out.pathname}`);
