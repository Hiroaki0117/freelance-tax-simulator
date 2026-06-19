import { Simulator } from '@/components/Simulator';
import { DISCLAIMER_LONG } from '@/lib/disclaimer';
import { TAX_YEAR } from '@/lib/tax/constants';

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <p className="mb-2 text-sm font-medium text-emerald-700">
          フリーランス・個人事業主向け / 無料
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          税金シミュレーター
          <span className="text-emerald-600"> × AI対話</span>
        </h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          「結局いくら残る? いくら取られる?」に即答。所得税・住民税・国保・国民年金・事業税・消費税と
          <strong>手取り</strong>をまるごとザックリ概算します({TAX_YEAR}年度版)。
        </p>
      </header>

      <Simulator />

      <footer className="mt-12 border-t border-slate-200 pt-6 text-xs leading-relaxed text-slate-500">
        <p>{DISCLAIMER_LONG}</p>
        <p className="mt-3">
          走るフリーランスエンジニアが、自分の不便をAIで潰すついでに公開した個人開発ツールです。
        </p>
      </footer>
    </main>
  );
}
