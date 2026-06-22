import Anthropic from '@anthropic-ai/sdk';
import { calculateTax } from '@/lib/tax/calculator';
import { describeInput, formatYen } from '@/lib/tax/format';
import type {
  ConsumptionTaxMode,
  FilingType,
  InsuranceType,
  TaxInput,
  TaxResult,
} from '@/lib/tax/types';
import { DISCLAIMER_SHORT } from '@/lib/disclaimer';

export const runtime = 'nodejs';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
const MAX_MESSAGES = 16;
const MAX_CONTENT_LENGTH = 1000;
const MAX_TOOL_ITERATIONS = 4;
const RATE_LIMIT = Number(process.env.CHAT_RATE_LIMIT_PER_MINUTE || 8);

// ベストエフォートのレート制限(プロセス内・コールドスタートでリセット)。
// 本番ではKV等の永続ストアに置き換える前提。
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  const arr = (hits.get(ip) ?? []).filter((t) => t > windowStart);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_LIMIT;
}

const FILING_TYPES: FilingType[] = ['blue65', 'blue10', 'white'];
const CONSUMPTION_MODES: ConsumptionTaxMode[] = [
  'exempt',
  'special2wari',
  'simplified',
  'general',
];
const INSURANCE_TYPES: InsuranceType[] = [
  'kokuho',
  'voluntary',
  'other',
  'dependent',
];

/** クライアントから渡された入力を安全な TaxInput に整える */
function sanitizeInput(raw: unknown): TaxInput {
  const r = (raw ?? {}) as Record<string, unknown>;
  const cap = (v: unknown) =>
    Math.min(10_000_000_000, Math.max(0, Math.round(Number(v) || 0)));
  return {
    revenue: cap(r.revenue),
    expenses: cap(r.expenses),
    filingType: FILING_TYPES.includes(r.filingType as FilingType)
      ? (r.filingType as FilingType)
      : 'blue65',
    hasSpouse: Boolean(r.hasSpouse),
    dependents: Math.min(10, Math.max(0, Math.floor(Number(r.dependents) || 0))),
    consumptionTax: CONSUMPTION_MODES.includes(
      r.consumptionTax as ConsumptionTaxMode
    )
      ? (r.consumptionTax as ConsumptionTaxMode)
      : 'exempt',
    insurance: INSURANCE_TYPES.includes(r.insurance as InsuranceType)
      ? (r.insurance as InsuranceType)
      : 'kokuho',
    healthInsuranceManual: cap(r.healthInsuranceManual),
    businessTaxApplicable:
      r.businessTaxApplicable === undefined
        ? true
        : Boolean(r.businessTaxApplicable),
    age40OrOver: Boolean(r.age40OrOver),
  };
}

/** AI に渡す計算結果の要約(トークン節約のため主要値のみ) */
function summarize(result: TaxResult) {
  return {
    事業所得: result.businessIncome,
    所得税: result.incomeTax,
    住民税: result.residentTax,
    個人事業税: result.businessTax,
    消費税: result.consumptionTax,
    国民健康保険: result.healthInsurance,
    国民年金: result.nationalPension,
    税社会保険の合計: result.burdenTotal,
    手取り: result.takeHome,
    売上に対する負担率: Number(
      (result.effectiveRateOnRevenue * 100).toFixed(1)
    ),
    毎月の積立目安: result.monthlyReserve,
    ふるさと納税の上限目安: result.furusatoNozeiLimit,
  };
}

const SIMULATE_TOOL: Anthropic.Tool = {
  name: 'simulate_tax',
  description:
    'フリーランスの税金・社会保険・手取りを概算する。現在の入力に対し、指定した項目だけを上書きして再計算する。' +
    '青色+iDeCo+ふるさと納税をまとめて適用するなど、複数条件を同時に変える試算が必要なときに使う。' +
    '推測で数字を出さず、必ずこのツールで再計算してから差額を答えること。',
  input_schema: {
    type: 'object',
    properties: {
      revenue: { type: 'number', description: '年間売上(税込・円)' },
      expenses: { type: 'number', description: '年間経費(円)' },
      filingType: {
        type: 'string',
        enum: FILING_TYPES,
        description: '青色65万/青色10万/白色',
      },
      hasSpouse: { type: 'boolean', description: '配偶者を扶養しているか' },
      dependents: { type: 'integer', description: '扶養親族(16歳以上)の人数' },
      consumptionTax: {
        type: 'string',
        enum: CONSUMPTION_MODES,
        description: '免税/2割特例/簡易課税/本則課税',
      },
      insurance: {
        type: 'string',
        enum: INSURANCE_TYPES,
        description:
          'kokuho(国保) / voluntary(任意継続) / other(その他健保) / dependent(扶養内)。voluntary・other は healthInsuranceManual に保険料(年額)を指定する',
      },
      healthInsuranceManual: {
        type: 'number',
        description: '任意継続・その他を選んだ場合の健康保険料(年額・円)',
      },
      businessTaxApplicable: {
        type: 'boolean',
        description: '個人事業税の対象業種か(非該当なら false で0円)',
      },
      age40OrOver: { type: 'boolean', description: '40歳以上か' },
    },
    required: [],
  },
};

function systemPrompt(base: TaxInput, result: TaxResult): string {
  return [
    'あなたはフリーランス/個人事業主向けの税金シミュレーターに付属するAIアシスタントです。',
    '対象はITフリーランスなど。専門用語はかみ砕いて、簡潔で親しみやすい日本語で答えてください。',
    '',
    '入力フォームは数値を変えると即座に再計算されます。あなたの主な役割は「数字を出すこと」ではなく、',
    '画面に出ている数字の意味の説明・なぜその金額になるのかの解説・次にやるとよいことの提案です。',
    '',
    '## いまのユーザーの試算',
    `入力: ${describeInput(base)}`,
    `結果(概算): ${JSON.stringify(summarize(result))}`,
    '',
    '## ルール',
    '- まず、いま出ている数字の意味・なぜその金額になるか・次の一手を、画面の具体的な金額を引用して分かりやすく説明することを最優先にする。',
    '- 1項目を変えるだけの質問は、フォームを直接操作すればすぐ分かる旨を案内してよい。',
    '- 青色+iDeCo+ふるさと納税をまとめて適用するなど、複数条件を同時に変える試算が必要なときだけ simulate_tax ツールで再計算し、変化(差額)を具体的な金額で示すこと。推測で数字を出さない。',
    '- 一般的な節税の考え方は提示してよいが、個別・断定的な判断は避け、税理士・確定申告での確認を促すこと。',
    `- 回答の最後に必ず一言、概算である旨の注意書きを添えること(例:「${DISCLAIMER_SHORT}」)。`,
    '- 金額は「円」で、桁区切りを使って読みやすく示すこと。',
  ].join('\n');
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          'AI対話は現在準備中です(APIキー未設定)。シミュレーター本体はそのままお使いいただけます。',
      },
      { status: 503 }
    );
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (rateLimited(ip)) {
    return Response.json(
      { error: '混み合っています。1分ほどおいて再度お試しください。' },
      { status: 429 }
    );
  }

  let body: { input?: unknown; messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '不正なリクエストです。' }, { status: 400 });
  }

  const baseInput = sanitizeInput(body.input);
  const baseResult = calculateTax(baseInput);

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const messages: Anthropic.MessageParam[] = rawMessages
    .slice(-MAX_MESSAGES)
    .filter(
      (m): m is ChatMessage =>
        !!m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0
    )
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_CONTENT_LENGTH),
    }));

  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return Response.json(
      { error: '質問を入力してください。' },
      { status: 400 }
    );
  }

  const client = new Anthropic({ apiKey });
  const system = systemPrompt(baseInput, baseResult);

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system,
        tools: [SIMULATE_TOOL],
        messages,
      });

      if (response.stop_reason !== 'tool_use') {
        const reply = response.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as Anthropic.TextBlock).text)
          .join('\n')
          .trim();
        return Response.json({
          reply: reply || '回答を生成できませんでした。もう一度お試しください。',
        });
      }

      // tool_use を実行して結果を返す
      messages.push({ role: 'assistant', content: response.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const overrides = sanitizeInput({
          ...baseInput,
          ...(block.input as Partial<TaxInput>),
        });
        const scenario = calculateTax(overrides);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify({
            前提: describeInput(overrides),
            結果: summarize(scenario),
            手取り表示: formatYen(scenario.takeHome),
          }),
        });
      }
      messages.push({ role: 'user', content: toolResults });
    }

    return Response.json({
      reply:
        '計算が複雑になりすぎました。条件を一つずつ変えて質問していただけると正確に答えられます。',
    });
  } catch (err) {
    console.error('chat error', err);
    return Response.json(
      { error: 'AIの呼び出しに失敗しました。時間をおいて再度お試しください。' },
      { status: 502 }
    );
  }
}
