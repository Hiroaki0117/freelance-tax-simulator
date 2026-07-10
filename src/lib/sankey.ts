// 「お金の流れ」サンキー図(UX案 4-1)の配置を計算する純関数モジュール。
//
// 売上を1本のプール(左のノード)として、そこから
//   経費 / 税金 / 保険・年金 / 手取り
// の4区分へ流れていく帯(flow)を描くための座標を返す。
// 積み上げバー(BreakdownBar)の上位互換で、「取られていく」流れが直感的に見える。
//
// 配置だけを返す純関数にしてあるので、画面(React の inline SVG)からも、
// 将来のシェア画像(SVG文字列)からも同じ図形を使える。色は画面・シェアで共通の正準パレット。

import type { TaxResult } from './tax/types';

/** お金の流れ図の配色(画面・シェア画像で共通に使う正準パレット) */
export const SANKEY_COLORS = {
  source: '#cfc4ac', // 売上プール(中立のクリーム。4区分の色を邪魔しない)
  expense: '#e0d6bf', // 経費(cream-300)
  tax: '#fbbf24', // 税金(amber-400)
  insurance: '#0ea5e9', // 保険・年金(sky-500。税のamberと色相を離す)
  takeHome: '#059669', // 手取り(emerald-600)
} as const;

export type SankeyKey = 'expense' | 'tax' | 'insurance' | 'takeHome';

export interface SankeySegment {
  key: SankeyKey;
  label: string;
  value: number;
  color: string;
}

/** TaxResult を、売上→(経費/税金/保険・年金/手取り)の4区分に分解する(積み上げバーと同じ定義) */
export function sankeySegments(r: TaxResult): SankeySegment[] {
  return [
    { key: 'expense', label: '経費', value: r.input.expenses, color: SANKEY_COLORS.expense },
    { key: 'tax', label: '税金', value: r.taxTotal, color: SANKEY_COLORS.tax },
    {
      key: 'insurance',
      label: '保険・年金',
      value: r.socialInsuranceTotal,
      color: SANKEY_COLORS.insurance,
    },
    { key: 'takeHome', label: '手取り', value: r.takeHome, color: SANKEY_COLORS.takeHome },
  ];
}

/** 右側の到達ノード(1区分ぶん) */
export interface SankeyNode {
  key: SankeyKey;
  label: string;
  value: number;
  pct: number; // 0..1(total に対する割合)
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cy: number; // ノードの縦中心
  labelCy: number; // ラベルの縦位置(隣とぶつからないよう最低間隔を確保した後)
}

/** 売上→区分 の帯(塗りつぶしパス) */
export interface SankeyFlow {
  key: SankeyKey;
  color: string;
  d: string;
  thickness: number;
}

export interface SankeyLayout {
  width: number;
  height: number;
  total: number; // 4区分(正の値)の合計
  source: {
    value: number;
    x: number;
    y: number;
    w: number;
    h: number;
    cy: number;
    color: string;
  };
  targets: SankeyNode[];
  flows: SankeyFlow[];
  labelX: number; // 右側ラベルの開始x
}

export interface SankeyOptions {
  width?: number;
  height?: number;
  nodeWidth?: number;
  gap?: number; // 右側ノード間のすき間
  padY?: number; // 上下の余白
  labelWidth?: number; // 右側ラベル領域の幅
  labelMinSpacing?: number; // ラベルどうしの最低縦間隔(2行ぶん)
}

/**
 * 4区分のサンキー図の配置を計算する。
 * 手取りマイナスなど値が0以下の区分は積み上げバーと同様に除外する。
 * 合計が0以下(売上が無いなど)なら null を返す。
 */
export function buildSankeyLayout(
  segments: SankeySegment[],
  opts: SankeyOptions = {}
): SankeyLayout | null {
  const width = opts.width ?? 340;
  const height = opts.height ?? 300;
  const nodeWidth = opts.nodeWidth ?? 14;
  const gap = opts.gap ?? 8;
  const padY = opts.padY ?? 6;
  const labelWidth = opts.labelWidth ?? 122;
  const labelMinSpacing = opts.labelMinSpacing ?? 34;

  const segs = segments.filter((s) => s.value > 0);
  const total = segs.reduce((a, s) => a + s.value, 0);
  if (total <= 0 || segs.length === 0) return null;

  const n = segs.length;
  const plotTop = padY;
  const plotH = height - padY * 2;
  const gapsTotal = gap * (n - 1);
  const availH = plotH - gapsTotal; // ノード実体(帯)ぶんの高さ
  const scale = availH / total;

  const srcX = 2;
  const srcW = nodeWidth;
  const tgtW = nodeWidth;
  const tgtX = width - labelWidth - tgtW;
  const srcRight = srcX + srcW;
  const midX = (srcRight + tgtX) / 2;

  // ソースノード:すき間ぶん短く、縦中央寄せ(スライスはすき間なしで連続)
  const srcH = availH;
  const srcY = plotTop + gapsTotal / 2;
  const source = {
    value: total,
    x: srcX,
    y: srcY,
    w: srcW,
    h: srcH,
    cy: srcY + srcH / 2,
    color: SANKEY_COLORS.source,
  };

  let sy = srcY; // ソース側:上端から詰める
  let ty = plotTop; // ターゲット側:全高に広げる(ノード間にすき間)
  const targets: SankeyNode[] = [];
  const flows: SankeyFlow[] = [];
  for (const s of segs) {
    const h = s.value * scale;
    const sy0 = sy;
    const sy1 = sy + h;
    const ty0 = ty;
    const ty1 = ty + h;
    targets.push({
      key: s.key,
      label: s.label,
      value: s.value,
      pct: s.value / total,
      color: s.color,
      x: tgtX,
      y: ty0,
      w: tgtW,
      h,
      cy: ty0 + h / 2,
      labelCy: ty0 + h / 2, // いったんノード中心。この後で最低間隔をとる
    });
    const d = [
      `M${srcRight},${round(sy0)}`,
      `C${round(midX)},${round(sy0)} ${round(midX)},${round(ty0)} ${tgtX},${round(ty0)}`,
      `L${tgtX},${round(ty1)}`,
      `C${round(midX)},${round(ty1)} ${round(midX)},${round(sy1)} ${srcRight},${round(sy1)}`,
      'Z',
    ].join(' ');
    flows.push({ key: s.key, color: s.color, d, thickness: h });
    sy = sy1;
    ty = ty1 + gap;
  }

  // ラベルが縦に重ならないよう、上から順に最低間隔を確保して押し下げる
  let lastLabelY = -Infinity;
  for (const t of targets) {
    const y = Math.max(t.cy, lastLabelY + labelMinSpacing);
    t.labelCy = y;
    lastLabelY = y;
  }

  return {
    width,
    height,
    total,
    source,
    targets,
    flows,
    labelX: tgtX + tgtW + 8,
  };
}

/** TaxResult から直接サンキー図の配置を得る */
export function buildSankeyFromResult(
  r: TaxResult,
  opts?: SankeyOptions
): SankeyLayout | null {
  return buildSankeyLayout(sankeySegments(r), opts);
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}
