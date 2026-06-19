'use client';

import { useRef, useState } from 'react';
import type { TaxInput, TaxResult } from '@/lib/tax/types';

interface Props {
  input: TaxInput;
  result: TaxResult;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'あと売上100万円増えたら、税金はどう変わる?',
  '外注費を50万円増やしたら手取りはどうなる?',
  'インボイス登録して2割特例にすると?',
  '青色65万円控除にしたら、いくら変わる?',
];

export function ChatPanel({ input, result }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;

    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setDraft('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, messages: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'エラーが発生しました。');
        return;
      }
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: data.reply as string },
      ]);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      });
    } catch {
      setError('通信に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">AIに相談する</h2>
      <p className="mt-1 text-xs text-slate-500">
        いまの試算をもとに、「もし◯◯したら?」を自然な言葉で質問できます。
      </p>

      {messages.length > 0 && (
        <div
          ref={listRef}
          className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === 'user' ? 'flex justify-end' : 'flex justify-start'
              }
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                  m.role === 'user'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-500">
                考えています…
              </div>
            </div>
          )}
        </div>
      )}

      {messages.length === 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={loading}
              onClick={() => send(s)}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <input
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          placeholder="例: 売上が800万になったら?"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !draft.trim()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          送信
        </button>
      </form>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        AIの回答は一般的な考え方にもとづく概算です。個別の判断は税理士や確定申告でご確認ください。
        現在の試算({Math.round(result.takeHome / 10000)}万円の手取り)を文脈として渡しています。
      </p>
    </div>
  );
}
