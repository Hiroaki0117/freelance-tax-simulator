import { ImageResponse } from 'next/og';
import { calculateTax } from '@/lib/tax/calculator';
import { TAX_YEAR } from '@/lib/tax/constants';
import { applyShareParams, parseShareParams } from '@/lib/tax/urlParams';
import { getOgFont } from './font';

export const runtime = 'nodejs';

const WIDTH = 1200;
const HEIGHT = 630;

const C = {
  bg: '#faf5ec',
  card: '#ffffff',
  ink900: '#3e3a33',
  ink500: '#8a8377',
  emerald: '#059669',
  emerald700: '#047857',
  expense: '#e0d6bf',
  tax: '#fbbf24',
  insurance: '#0ea5e9',
  takeHome: '#059669',
};

function man(v: number): string {
  return Math.round(v / 10000).toLocaleString('ja-JP');
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const input = applyShareParams(parseShareParams(searchParams));
  const result = calculateTax(input);

  const rev = man(result.input.revenue);
  const takeRate =
    result.input.revenue > 0
      ? Math.round((result.takeHome / result.input.revenue) * 100)
      : 0;

  const segs = [
    { value: result.input.expenses, color: C.expense },
    { value: result.taxTotal, color: C.tax },
    { value: result.socialInsuranceTotal, color: C.insurance },
    { value: result.takeHome, color: C.takeHome },
  ];
  const total = segs.reduce((a, s) => a + Math.max(0, s.value), 0) || 1;

  let font: ArrayBuffer | null = null;
  try {
    font = await getOgFont();
  } catch (err) {
    console.error('og font fetch failed', err);
  }

  return new ImageResponse(
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        padding: 40,
        backgroundColor: C.bg,
        fontFamily: 'Noto Sans JP',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          backgroundColor: C.card,
          borderRadius: 40,
          padding: '48px 56px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 28, color: C.ink500 }}>
            フリーランスの手取りざっくりシミュレーター
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: C.ink500 }}>
            令和7年({TAX_YEAR}年)分
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            marginTop: 28,
            gap: 56,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 32, color: C.ink900 }}>
              手取り(年)
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <div
                style={{
                  display: 'flex',
                  fontSize: 148,
                  fontWeight: 700,
                  color: C.emerald,
                  lineHeight: 1,
                }}
              >
                {man(result.takeHome)}
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 56,
                  fontWeight: 700,
                  color: C.emerald,
                  marginLeft: 6,
                }}
              >
                万円
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 24, color: C.ink500 }}>
              手取り率
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 52,
                fontWeight: 700,
                color: C.emerald700,
              }}
            >
              {takeRate}%
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 20,
            fontSize: 26,
            color: C.ink500,
          }}
        >
          売上{rev}万円のうち、税・保険で {man(result.burdenTotal)}万円
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 'auto',
            height: 44,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {segs.map((s, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                width: `${(Math.max(0, s.value) / total) * 100}%`,
                backgroundColor: s.color,
                height: '100%',
              }}
            />
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 24,
            fontSize: 22,
            color: C.ink500,
          }}
        >
          <div style={{ display: 'flex' }}>freelance-tedori.com</div>
          <div
            style={{ display: 'flex', color: C.emerald700, fontWeight: 700 }}
          >
            @freelance_hiro
          </div>
        </div>
      </div>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: font
        ? [{ name: 'Noto Sans JP', data: font, weight: 700, style: 'normal' }]
        : undefined,
    }
  );
}
