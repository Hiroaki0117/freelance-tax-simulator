import type { Metadata } from 'next';
import { Simulator } from '@/components/Simulator';
import { ShareCta } from '@/components/ShareCta';
import { DISCLAIMER_LONG } from '@/lib/disclaimer';
import { calculateTax } from '@/lib/tax/calculator';
import {
  applyShareParams,
  hasShareParams,
  parseShareParams,
} from '@/lib/tax/urlParams';

type SearchParams = Record<string, string | string[] | undefined>;

function toURLSearchParams(sp: SearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') params.set(key, value);
  }
  return params;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const usp = toURLSearchParams(await searchParams);
  if (!hasShareParams(usp)) return {};

  const input = applyShareParams(parseShareParams(usp));
  const result = calculateTax(input);
  const title = `手取り${Math.round(result.takeHome / 10000).toLocaleString('ja-JP')}万円 — フリーランスの手取りざっくりシミュレーター`;
  const description = `売上${Math.round(input.revenue / 10000).toLocaleString('ja-JP')}万円のフリーランスの手取りをざっくり試算。あなたの場合もリンクを開いてすぐ確認できます。`;
  const ogImage = `/api/og?${usp.toString()}`;

  return {
    title,
    description,
    openGraph: { title, description, images: [ogImage] },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const usp = toURLSearchParams(await searchParams);
  const initialInput = hasShareParams(usp) ? parseShareParams(usp) : undefined;

  return (
    <main className="mx-auto max-w-xl px-5 py-10 sm:py-14">
      <header className="mb-7">
        <p className="mb-3 inline-block rounded-full bg-emerald-600/10 px-3.5 py-1 text-xs font-semibold text-emerald-700">
          フリーランスむけ
        </p>
        <h1 className="text-4xl font-extrabold leading-[1.3] tracking-tight sm:text-[2.6rem]">
          手取り、
          <br />
          <span className="text-emerald-600">いくら残る?</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-500 sm:text-base">
          売上をいれるだけ。所得税・住民税・国保・年金・事業税・消費税、ぜんぶ込みで
          <strong className="text-ink-900">3秒でざっくり</strong>。
        </p>
      </header>

      <Simulator initialInput={initialInput} />

      <ShareCta />

      <footer className="mt-12 border-t border-cream-300 pt-6 text-xs leading-relaxed text-ink-400">
        <p className="mb-2 font-semibold text-ink-500">
          フリーランスの手取りざっくりシミュレーター
        </p>
        <p>{DISCLAIMER_LONG}</p>
        <p className="mt-3">
          走るフリーランスエンジニアが、自分の不便をAIで潰すついでに公開した個人開発ツールです。
        </p>
      </footer>
    </main>
  );
}
