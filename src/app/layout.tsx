import type { Metadata, Viewport } from 'next';
import './globals.css';

const SITE_URL = 'https://freelance-tax-simulator.vercel.app';
const SITE_NAME = 'フリーランスの手取りざっくりシミュレーター';
const SITE_DESCRIPTION =
  '売上をいれるだけ。所得税・住民税・国保・年金・事業税・消費税をぜんぶ込みで、フリーランスの手取りをざっくり概算する無料ツール。';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description:
    'フリーランス/個人事業主の「結局いくら残る?いくら取られる?」に即答。売上をいれるだけで、所得税・住民税・国保・年金・事業税・消費税と手取りをまるごとざっくり概算する無料ツール。登録不要・入力は保存されません。',
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
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
