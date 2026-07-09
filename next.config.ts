import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // /api/og が実行時に読むサブセットフォントをサーバーレスバンドルに含める
  outputFileTracingIncludes: {
    '/api/og': ['./src/app/api/og/fonts/*.ttf'],
  },
};

export default nextConfig;
