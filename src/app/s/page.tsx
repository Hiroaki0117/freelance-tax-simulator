// 共有URL(/s?r=…)で開かれた結果の再現ページ
//
// - トップ `/` は静的のまま守り、こちらだけ dynamic rendering にする
//   (searchParams を読む=リクエスト毎レンダリング)
// - generateMetadata で「売上◯万 → 手取り◯万」のOGPタグと /api/og の画像を出す
// - 中身はトップと同じ HomeContent。開いた人はそのまま自分の数字に打ち替えられる

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { HomeContent } from '@/components/HomeContent';
import { calculateTax } from '@/lib/tax/calculator';
import { man } from '@/lib/og/text';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { decodeShareParams, encodeShareParams } from '@/lib/tax/urlParams';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const input = decodeShareParams(await searchParams);
  if (!input) return {};

  const r = calculateTax(input);
  const takeRate = Math.round((r.takeHome / input.revenue) * 100);
  const title = `売上${man(input.revenue)}万円 → 手取り${man(r.takeHome)}万円(残る${takeRate}%)`;
  const description = `税金と保険はぜんぶ込みで${man(r.burdenTotal)}万円。あなたはいくら残る?売上をいれるだけ、3秒でざっくり。`;
  const ogImageUrl = `/api/og?${encodeShareParams(input)}`;

  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    // 個人の数字入りURLの無限バリエーションを検索エンジンに索引させない
    alternates: { canonical: SITE_URL },
    openGraph: {
      title,
      description,
      type: 'website',
      url: SITE_URL,
      siteName: SITE_NAME,
      locale: 'ja_JP',
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function SharedResultPage({ searchParams }: Props) {
  const input = decodeShareParams(await searchParams);
  if (!input) redirect('/');
  return <HomeContent initialInput={input} />;
}
