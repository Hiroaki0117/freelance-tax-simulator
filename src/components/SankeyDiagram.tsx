import type { TaxResult } from '@/lib/tax/types';
import { buildSankeyFromResult } from '@/lib/sankey';

function man(value: number): string {
  return (value / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 0 });
}

/**
 * 「お金の流れ」サンキー図(UX案 4-1)。
 * 売上プール(左)から 経費 / 税金 / 保険・年金 / 手取り へ流れる帯を SVG で描く。
 * 配置は純関数 buildSankeyFromResult に任せ、ここは描画だけ(画面とシェアで図形を共有できる)。
 */
export function SankeyDiagram({ result }: { result: TaxResult }) {
  const layout = buildSankeyFromResult(result);
  if (!layout) return null;

  const { width, height, source, targets, flows, labelX } = layout;
  const desc = `売上${man(result.input.revenue)}万円が、${targets
    .map((t) => `${t.label}${man(t.value)}万円`)
    .join('、')}に分かれていく流れ図`;

  return (
    <div className="overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        className="h-auto"
        role="img"
        aria-label={desc}
      >
        {/* 帯(パステルの流れ)を先に描き、その上にノードの実体を重ねる */}
        {flows.map((f) => (
          <path key={f.key} d={f.d} fill={f.color} opacity={0.72} />
        ))}

        {/* 売上プール(中立色) */}
        <rect
          x={source.x}
          y={source.y}
          width={source.w}
          height={source.h}
          rx={3}
          fill={source.color}
          stroke="rgba(0,0,0,0.06)"
        />

        {/* 到達ノード + 右側ラベル(名前 / 金額・割合) */}
        {targets.map((t) => (
          <g key={t.key}>
            <rect
              x={t.x}
              y={t.y}
              width={t.w}
              height={Math.max(1, t.h)}
              rx={3}
              fill={t.color}
              stroke="rgba(0,0,0,0.06)"
            />
            <text
              x={labelX}
              y={t.labelCy - 4}
              fontSize={12}
              fontWeight={600}
              fill="#6b655b"
            >
              {t.label}
            </text>
            <text x={labelX} y={t.labelCy + 13} fontSize={14} fontWeight={700} fill="#3e3a33">
              {man(t.value)}万
              <tspan fontSize={11} fontWeight={500} fill="#8a8377" dx={5}>
                {Math.round(t.pct * 100)}%
              </tspan>
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
