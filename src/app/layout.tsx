import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'フリーランス税金シミュレーター × AI対話',
  description:
    'フリーランス/個人事業主の「結局いくら残る?いくら取られる?」に即答。所得税・住民税・国保・年金・事業税・消費税と手取りをまるごとザックリ概算し、AIに what-if を質問できる無料ツール。',
  openGraph: {
    title: 'フリーランス税金シミュレーター × AI対話',
    description:
      'フリーランスの手取りと税金をまるごとザックリ概算。AIに「外注費を増やしたら?」などの what-if を質問できる無料ツール。',
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
