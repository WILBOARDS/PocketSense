import { useEffect, useRef, useState } from 'react';
import { BackBar } from '../components/common';
import { Info, Send } from '../components/icons';
import { functionError, useAccount } from '../lib/account';
import { askContext, isAnswer, type Answer, type Turn } from '../lib/ask';
import { nextMonday } from '../lib/dates';
import { weekStats } from '../lib/derive';
import { money, money0, plural } from '../lib/format';
import { getLang, tr } from '../lib/i18n';
import { useData } from '../lib/store';
import { supabase } from '../lib/supabase';
import type { Data } from '../lib/types';
import { useUi } from '../ui';

const MAX_QUESTION = 300;

type AskResult = { ok: true; answer: Answer } | { ok: false; error: string };

async function ask(question: string, history: Turn[], data: Data, now: number): Promise<AskResult> {
  if (!supabase) return { ok: false, error: '' };
  const { data: reply, error } = await supabase.functions.invoke('ask', {
    body: {
      question,
      lang: getLang(),
      context: askContext(data, now),
      history: history.filter(t => t.a).slice(-3).map(t => ({ q: t.q, a: `${t.a!.headline} ${t.a!.body}` })),
    },
  });
  if (error) return { ok: false, error: await functionError(error) };
  return isAnswer(reply) ? { ok: true, answer: reply } : { ok: false, error: '' };
}

// The conversation lives as long as the app is open, so leaving the tab and coming back keeps it.
// It is never saved, and it's cleared when nobody is signed in.
let kept: Turn[] = [];

export function Ask() {
  const acc = useAccount();
  const { go, layout } = useUi();
  const signedIn = acc.enabled && acc.status === 'in';
  // The server checks this too; this just shows the reason instead of a chat that can't answer.
  const minor = (signedIn || acc.status === 'pendingConsent') && !!acc.profile?.minor;
  if (!signedIn || minor) kept = [];

  return (
    <div className="screen-fill" style={{ height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: layout === 'full' ? '20px 28px' : '8px 8px 8px 20px', minHeight: 60 }}>
        <span className={layout === 'full' ? 'wide-title' : 'page-title'}>{tr('Ask', 'Tanya')}</span>
        {layout === 'full' && <span className="t14 muted">{tr('Can I afford it?', 'Mampu nggak?')}</span>}
      </div>
      <div className="rule" />
      {signedIn && !minor ? <Chat /> : (
        <div style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <AiNote />
          <div className="pretty" style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1, paddingTop: 12 }}>
            {!acc.enabled ? tr('Ask isn\'t set up yet', 'Fitur Tanya belum diatur')
              : minor ? tr('Ask is for 18+', 'Tanya khusus usia 18+')
              : tr('Ask needs an account', 'Fitur Tanya butuh akun')}
          </div>
          <div className="t15 pretty" style={{ lineHeight: 1.5 }}>
            {!acc.enabled
              ? tr('This copy of Pocket Sense has no server, so there is nothing to answer questions.', 'Salinan Pocket Sense ini tidak punya server, jadi belum ada yang bisa menjawab pertanyaan.')
              : minor
                ? tr("Ask is only for people 18 or older, so it isn't available on your account. Everything else in Pocket Sense works as normal.", 'Fitur Tanya hanya untuk usia 18 tahun ke atas, jadi tidak tersedia di akunmu. Fitur Pocket Sense lainnya tetap bisa dipakai seperti biasa.')
                : tr('Answers come from an AI on our server, so your question and a summary of what you logged have to leave this phone. Sign in to use it.',
                  'Jawaban dibuat oleh AI di server kami, jadi pertanyaan dan ringkasan catatanmu harus dikirim dari HP ini. Masuk untuk memakainya.')}
          </div>
          {acc.enabled && acc.status === 'out' && (
            <button className="btn btn-primary btn-md self-start" onClick={() => go('signin')}>{tr('Sign in', 'Masuk')}</button>
          )}
        </div>
      )}
    </div>
  );
}

function AiNote() {
  const { go } = useUi();
  return (
    <div role="note" className="note-box">
      <Info />
      <span>
        {tr('This is AI. AI can make mistakes.', 'Ini AI. AI bisa salah.')}{' '}
        <a href="#ask-about" className="w6" onClick={e => { e.preventDefault(); go('ask-about'); }}>{tr('Read the documentation', 'Baca dokumentasi')}</a>
      </span>
    </div>
  );
}

function Chat() {
  const { data, actions } = useData();
  const { now, go, toast } = useUi();
  const [turns, setTurns] = useState<Turn[]>(kept);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const end = useRef<HTMLDivElement>(null);
  kept = turns;

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [turns.length, busy]);

  const week = weekStats(data, now);
  const suggestions = [
    tr('Where did my money go?', 'Uangku habis ke mana?'),
    tr('How much can I spend today?', 'Hari ini boleh jajan berapa?'),
    tr(`Can I afford something for ${money0(Math.round(week.weekMoney * 0.5))}?`, `Aku mampu beli barang ${money0(Math.round(week.weekMoney * 0.5))} nggak?`),
  ];

  const send = async (q: string) => {
    const question = q.trim().slice(0, MAX_QUESTION);
    if (!question || busy) return;
    setError('');
    setText('');
    setBusy(true);
    const before = turns;
    setTurns([...before, { q: question }]);
    const r = await ask(question, before, data, Date.now());
    setBusy(false);
    if (r.ok) setTurns([...before, { q: question, a: r.answer }]);
    else {
      setTurns(before);
      setText(question);
      setError(r.error || tr("Couldn't get an answer. Try again.", 'Belum dapat jawaban. Coba lagi.'));
    }
  };

  const park = (item: string, price: number, minutes: number, when: string) => {
    actions.park({ name: item, price, minutes });
    go('parking');
    toast(tr(`Parked. We'll ask again ${when}.`, `Diparkir. Kami tanya lagi ${when}.`));
  };

  return <>
    <div className="scroll chat-col" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AiNote />
      {turns.length === 0 && (
        <div className="t15 muted pretty" style={{ lineHeight: 1.5 }}>
          {tr('Answers use only what you logged in Pocket Sense. Nothing is linked to your bank.', 'Jawaban hanya memakai data yang kamu catat di Pocket Sense. Tidak terhubung ke bank.')}
        </div>
      )}
      {turns.map((t, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="bubble-q">{t.q}</div>
          {t.a && (
            <div className="answer">
              <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{t.a.headline}</div>
              <div className="t15 pretty" style={{ lineHeight: 1.5, whiteSpace: 'pre-line' }}>{t.a.body}</div>
              {t.a.price !== null && <>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', borderTop: '1px solid var(--color-divider)', borderBottom: '1px solid var(--color-divider)' }}>
                  <div style={{ padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 2, borderRight: '1px solid var(--color-divider)' }}>
                    <span className="t12 muted">{tr('Left this week', 'Sisa minggu ini')}</span>
                    <span className="t20 w8">{money(week.left)}</span>
                  </div>
                  <div style={{ padding: '10px 0 10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="t12 muted">{tr('After buying', 'Setelah beli')}</span>
                    <span className="t20 w8" style={{ color: week.left - t.a.price < 0 ? 'var(--color-accent-700)' : undefined }}>{money(week.left - t.a.price)}</span>
                  </div>
                </div>
                <div className="t12 muted">
                  {tr(`Based on ${plural(week.purchases.length, 'purchase')} this week and ${money0(week.weekMoney)} weekly money`,
                    `Berdasarkan ${week.purchases.length} pembelian minggu ini dan jatah ${money0(week.weekMoney)} per minggu`)}
                </div>
                {i === turns.length - 1 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button className="btn btn-primary" style={{ minHeight: 44, padding: '0 16px', fontSize: 14 }}
                      onClick={() => park(t.a!.item || tr('Something', 'Sesuatu'), t.a!.price!, 1440, tr('in 24 hours', 'dalam 24 jam'))}>
                      {tr('Park it for 24 hours', 'Parkir 24 jam')}
                    </button>
                    <button className="btn btn-secondary" style={{ minHeight: 44, padding: '0 16px', fontSize: 14 }}
                      onClick={() => park(t.a!.item || tr('Something', 'Sesuatu'), t.a!.price!, Math.ceil((nextMonday(now) - Date.now()) / 60000), tr('on Monday', 'hari Senin'))}>
                      {tr('Wait until Monday', 'Tunggu sampai Senin')}
                    </button>
                  </div>
                )}
              </>}
            </div>
          )}
        </div>
      ))}
      {busy && <div className="t14 muted" role="status">{tr('Thinking…', 'Sedang berpikir…')}</div>}
      <div ref={end} />
    </div>
    <div className="chat-col" style={{ flex: 'none', borderTop: '1px solid var(--color-neutral-300)' }}>
      {error && <div role="alert" className="t14 w6 accent-text" style={{ padding: '10px 20px 0' }}>{error}</div>}
      <div className="hscroll" style={{ padding: '8px 20px' }}>
        {suggestions.map(s => (
          <button key={s} className="chip" style={{ minHeight: 40, fontSize: 13, padding: '0 12px' }} disabled={busy} onClick={() => send(s)}>{s}</button>
        ))}
      </div>
      <form style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 48px', gap: 8, padding: '0 20px 12px' }}
        onSubmit={e => { e.preventDefault(); void send(text); }}>
        <input className="input" aria-label={tr('Your question', 'Pertanyaanmu')} placeholder={tr('Ask about your money…', 'Tanya soal uangmu…')}
          value={text} maxLength={MAX_QUESTION} onChange={e => { setText(e.target.value); setError(''); }} style={{ minHeight: 48, fontSize: 16 }} />
        <button type="submit" className="send-btn" aria-label={tr('Send', 'Kirim')} disabled={busy || !text.trim()}><Send /></button>
      </form>
    </div>
  </>;
}

/** What "Read the documentation" opens: how Ask works, in plain words. */
export function AskAbout({ onBack }: { onBack: () => void }) {
  const parts: [string, string][] = [
    [tr('What it is', 'Apa ini'), tr(
      'Ask answers questions about the money you logged, like "Can I afford Rp 189.000 earbuds?" or "Where did my money go?". An AI model writes the answer.',
      'Fitur Tanya menjawab pertanyaan soal uang yang kamu catat, misalnya "Aku mampu beli earbuds Rp 189.000 nggak?" atau "Uangku habis ke mana?". Jawabannya ditulis oleh model AI.')],
    [tr('What it knows', 'Apa yang diketahuinya'), tr(
      "Only what's in Pocket Sense: this week's money and spending, your purchases from the last 4 weeks (name, category, class, amount, mood, wallet and time), your goal and your parked items. It isn't linked to your bank and can't see anything you didn't log.",
      'Hanya yang ada di Pocket Sense: uang dan pengeluaran minggu ini, pembelianmu 4 minggu terakhir (nama, kategori, kelas, jumlah, mood, dompet, dan waktu), target, dan barang yang diparkir. Tidak terhubung ke bank dan tidak bisa melihat apa pun yang tidak kamu catat.')],
    [tr('Where it goes', 'Ke mana datanya'), tr(
      "Your question, that summary and your last few questions and answers in this chat go from our server to an AI service (NVIDIA or OpenRouter), which writes the answer. Those companies, or the company running the model, may keep what they receive; we can't control that. Your email and date of birth are never sent. We don't keep the questions or answers ourselves.",
      'Pertanyaanmu, ringkasan itu, dan beberapa pertanyaan serta jawaban terakhir di obrolan ini dikirim dari server kami ke layanan AI (NVIDIA atau OpenRouter) yang menulis jawabannya. Perusahaan-perusahaan itu, atau perusahaan penyedia modelnya, mungkin menyimpan apa yang mereka terima; kami tidak bisa mengendalikannya. Email dan tanggal lahirmu tidak pernah dikirim. Kami sendiri tidak menyimpan pertanyaan maupun jawabannya.')],
    [tr('It can be wrong', 'Bisa salah'), tr(
      'AI can misread a number or make something up. The "Left this week" and "After buying" figures are worked out by the app itself, not by the AI, so trust those over the text. Ask gives no investment or loan advice.',
      'AI bisa salah membaca angka atau mengarang. Angka "Sisa minggu ini" dan "Setelah beli" dihitung oleh aplikasi sendiri, bukan oleh AI, jadi lebih percayai angka itu daripada teksnya. Fitur Tanya tidak memberi saran investasi atau pinjaman.')],
    [tr('Limits', 'Batas'), tr(
      'You can ask up to 30 questions a day. Ask needs an account and is only for people 18 or older.',
      'Kamu bisa bertanya sampai 30 kali sehari. Fitur Tanya butuh akun dan hanya untuk usia 18 tahun ke atas.')],
  ];
  return (
    <div className="screen">
      <BackBar title={tr('About Ask', 'Tentang Tanya')} onBack={onBack} />
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, fontSize: 15, lineHeight: 1.55 }}>
        {parts.map(([h, p]) => (
          <div key={h} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{h}</div>
            <div className="pretty">{p}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
