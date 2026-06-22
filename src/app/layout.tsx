import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'フリーランス税金シミュレーター × AI対話',
  description:
    'フリーランス/個人事業主の「結局いくら残る?いくら取られる?」に即答。所得税・住民税・国保・年金・事業税・消費税と手取りをまるごとザックリ概算。さらに「この国保なんでこの額?」「毎月いくら貯める?」など、数字の意味と次の一手をAIに相談できる無料ツール。',
  openGraph: {
    title: 'フリーランス税金シミュレーター × AI対話',
    description:
      'フリーランスの手取り・税金をまるごとザックリ概算。「この国保なんで高い?」など数字の意味や次の一手をAIに相談できる無料ツール。',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
