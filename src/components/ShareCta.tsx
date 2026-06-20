const X_HANDLE: string = 'freelance_nishimura'; // オーナーのXハンドル(@抜き)。空き確認が取れ次第このまま本番へ

const SHARE_TEXT = 'フリーランスの税金シミュレーター、来年いくら払うか対話で計算できて便利だった。無料。';
const SHARE_URL = 'https://freelance-tax-simulator.vercel.app';
const SHARE_HASHTAGS = 'フリーランス,確定申告';

function buildShareUrl(): string {
  const params = new URLSearchParams({
    text: SHARE_TEXT,
    url: SHARE_URL,
    hashtags: SHARE_HASHTAGS,
  });
  return `https://x.com/intent/post?${params.toString()}`;
}

export function ShareCta() {
  const isHandleReady = X_HANDLE !== 'REPLACE_ME';
  const followHref = isHandleReady ? `https://x.com/${X_HANDLE}` : undefined;

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* フォロー CTA */}
      <div className="pb-5">
        <h2 className="text-base font-semibold text-slate-800">
          作ってるのは、現役フリーランスエンジニアです。
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          このツールは「確定申告のたびに自分が詰まる」のを潰すために作りました。税率は毎年変わるので、来年度版への対応や新機能はXでお知らせします。フリーランスのお金まわりのTipsも発信中。
        </p>
        <div className="mt-4">
          {isHandleReady ? (
            <a
              href={followHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              Xでフォローする
            </a>
          ) : (
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="inline-block cursor-not-allowed rounded-lg bg-slate-200 px-5 py-2.5 text-sm font-medium text-slate-400"
            >
              準備中
            </button>
          )}
        </div>
      </div>

      {/* 区切り */}
      <div className="border-t border-slate-100" />

      {/* シェア CTA */}
      <div className="pt-5">
        <p className="text-sm text-slate-600">
          役に立ったら、同じく悩んでる人にも教えてあげてください。
        </p>
        <div className="mt-3">
          <a
            href={buildShareUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Xでシェアする
          </a>
        </div>
      </div>
    </div>
  );
}
