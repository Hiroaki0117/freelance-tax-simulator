// シェア(画像・リンク)で使う文言とURLの組み立て
//
// プライバシー方針(裏取り: start-up-note2 docs/research/2026-07-09-url-share-dynamic-ogp-research.md):
// 共有URLはユーザーがシェア操作をした瞬間にだけ組み立てる。
// 自動でアドレスバーを書き換えたり、サーバーに保存したりしない。

import { man } from '@/lib/og/text';
import { SITE_URL } from '@/lib/site';
import { buildPaymentSchedule } from '@/lib/tax/calendar';
import type { TaxResult } from '@/lib/tax/types';
import { encodeShareParams } from '@/lib/tax/urlParams';
import type { ShareVariant } from '@/lib/shareImage';

export const SHARE_HASHTAGS = 'フリーランス,確定申告';

/** X投稿の定型文(シェア画像のバリアントに合わせて温度感を変える) */
export function shareMessage(r: TaxResult, variant: ShareVariant = 'brag'): string {
  const rev = man(r.input.revenue);
  const takeRate = Math.round((r.takeHome / r.input.revenue) * 100);
  const burdenRate = Math.round((r.burdenTotal / r.input.revenue) * 100);

  if (variant === 'empathy') {
    return (
      `売上${rev}万のフリーランス、税・保険で${man(r.burdenTotal)}万も持っていかれました😇(売上の${burdenRate}%)\n` +
      `手取りは${man(r.takeHome)}万(${takeRate}%)。あなたはいくら残った?👇`
    );
  }
  if (variant === 'prepare') {
    const peak = buildPaymentSchedule(r).peak;
    return (
      `フリーランスの来年、${peak.label}に${man(peak.total)}万円の支払いの山が来ます⛰️\n` +
      `毎月${man(r.monthlyTaxReserve)}万ずつよけておけば慌てない。あなたの山はいくら?👇`
    );
  }
  return (
    `売上${rev}万のフリーランス、手取りは${man(r.takeHome)}万でした。\n` +
    `税金と保険で${man(r.burdenTotal)}万(売上の${burdenRate}%)😇\n` +
    `あなたはいくら残る?👇`
  );
}

/** この結果を再現できる共有URL(プレビュー環境では自分のオリジンを使う) */
export function buildShareUrl(r: TaxResult): string {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : SITE_URL;
  return `${origin}/s?${encodeShareParams(r.input)}`;
}

export function xIntentUrl(text: string, url: string): string {
  return `https://x.com/intent/post?${new URLSearchParams({
    text,
    url,
    hashtags: SHARE_HASHTAGS,
  }).toString()}`;
}
