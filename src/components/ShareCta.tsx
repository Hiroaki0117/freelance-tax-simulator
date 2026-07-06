const X_HANDLE: string = 'freelance_hiro'; // オーナーのXハンドル(@抜き)

const SHARE_TEXT =
  '売上をいれるだけで、フリーランスの手取り・税金・保険がぜんぶ込みでパッと出る「手取りざっくりシミュレーター」。無料で便利だった。';
const SHARE_URL = 'https://freelance-tedori.com';
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
    <div className="mt-7 rounded-3xl bg-white p-6 shadow-warm">
      {/* フォロー CTA */}
      <div className="pb-5">
        <h2 className="text-base font-bold text-ink-900">
          作ってるのは、現役フリーランスエンジニアです。
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          このツールは「確定申告のたびに自分が詰まる」のを潰すために作りました。税率は毎年変わるので、来年度版への対応や新機能はXでお知らせします。フリーランスのお金まわりのTipsも発信中。
        </p>
        <div className="mt-4">
          {isHandleReady ? (
            <a
              href={followHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full bg-ink-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-600"
            >
              Xでフォローする
            </a>
          ) : (
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="inline-block cursor-not-allowed rounded-full bg-cream-200 px-6 py-2.5 text-sm font-semibold text-ink-400"
            >
              準備中
            </button>
          )}
        </div>
      </div>

      {/* 区切り */}
      <div className="border-t border-cream-200" />

      {/* シェア CTA */}
      <div className="pt-5">
        <p className="text-sm text-ink-600">
          役に立ったら、同じく悩んでる人にも教えてあげてください。
        </p>
        <div className="mt-3">
          <a
            href={buildShareUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Xでシェアする
          </a>
        </div>
      </div>
    </div>
  );
}
