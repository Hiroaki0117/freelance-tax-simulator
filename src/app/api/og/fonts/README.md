# OGP画像用フォント(Noto Sans JP サブセット)

`/api/og` の `ImageResponse`(satori)に渡す日本語フォント。
OGP画像に登場しうる文字(`charset.txt`・元は `src/lib/og/text.ts` の `OG_CHARSET`)だけに絞った Noto Sans JP を、weight 400 / 700 / 800 の3インスタンスで同梱している(各約12KB)。

- 実行時に Google Fonts へ取りに行かない(Xクローラーが画像を取得する瞬間に外部依存を作らない)ための事前サブセット方式。裏取り: `start-up-note2` リポジトリ `docs/research/2026-07-09-url-share-dynamic-ogp-research.md`
- satori は WOFF2 非対応・TTF/OTF/WOFF のみ対応なので TTF で持つ
- ライセンス: SIL OFL 1.1(`OFL.txt`)。サブセット化(改変)・再配布とも許諾範囲

## 再生成の手順(`src/lib/og/text.ts` の文言・文字を変えたとき)

`src/lib/og/text.test.ts` が `charset.txt` と `OG_CHARSET` の一致を見張っているので、
文言を変えてフォントを作り直し忘れるとテストが落ちる。手順:

```bash
# 0) 前提: Python の fonttools(pyftsubset)が必要
pip install fonttools

# 1) charset.txt を再生成
npx -y tsx scripts/generate-og-charset.ts

# 2) Noto Sans JP のバリアブルフォントを取得
curl -sSL -o /tmp/NotoSansJP-VF.ttf \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf"

# 3) 3ウェイトに静的化 → charset.txt の文字だけにサブセット
for W in 400 700 800; do
  fonttools varLib.instancer -q /tmp/NotoSansJP-VF.ttf wght=$W -o /tmp/inst-$W.ttf
  pyftsubset /tmp/inst-$W.ttf --text-file=src/app/api/og/fonts/charset.txt \
    --output-file=src/app/api/og/fonts/NotoSansJP-$W-subset.ttf \
    --layout-features='' --no-hinting --desubroutinize --name-IDs='0,1,2,6,13,14'
done

# 4) 検証(全文字がcmapに載っているか)
python3 - <<'EOF'
from fontTools.ttLib import TTFont
charset = open('src/app/api/og/fonts/charset.txt', encoding='utf-8').read()
for w in (400, 700, 800):
    f = TTFont(f'src/app/api/og/fonts/NotoSansJP-{w}-subset.ttf')
    cmap = f.getBestCmap()
    missing = [c for c in charset if ord(c) not in cmap]
    assert not missing, (w, missing)
print('OK')
EOF
```
