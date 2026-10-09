// Emails a parent or guardian a link to approve syncing for a user under 18.
// POST { parentEmail } with the user's session. Also used for "Resend request" (no body needed then).
//
// The limits and the new request are recorded in one step in the database (consent_take), so a burst of
// parallel calls can't get past them. The parent's address is saved on the profile only after the email went out.
import { isMinorOn, isTooYoungOn } from '../_shared/age.ts';
import { consentEmail, parentKey } from '../_shared/consent.ts';
import { admin, appLink, caller, fail, isEmail, json, randomToken, serve, sendEmail, sha256 } from '../_shared/util.ts';

const MAX_PER_CHILD_PER_DAY = 5;
const MAX_PER_PARENT_PER_DAY = 3;
const MAX_PER_DAY_IN_TOTAL = 200; // well under Brevo's free 300 a day, which also carries sign-up and reset emails
const MIN_GAP_SECONDS = 60;

const REFUSALS: Record<string, [string, string]> = {
  gap: ['Wait a minute before sending another request.', 'Tunggu semenit sebelum mengirim permintaan lagi.'],
  user_limit: ['Too many requests today. Try again tomorrow.', 'Terlalu banyak permintaan hari ini. Coba lagi besok.'],
  parent_limit: ['That address already got several requests today. Try again tomorrow.', 'Alamat itu sudah menerima beberapa permintaan hari ini. Coba lagi besok.'],
  global_limit: ["We can't send more approval emails right now. Try again tomorrow.", 'Kami tidak bisa mengirim email persetujuan lagi sekarang. Coba lagi besok.'],
};

serve(async req => {
  const db = admin();
  const user = await caller(req, db);
  if (!user) return fail('Sign in first.', 401);

  const body = await req.json().catch(() => ({}));
  const msg = (en: string, id: string) => (body.lang === 'id' ? id : en);
  const { data: profile, error } = await db.from('profiles').select('*').eq('id', user.id).single();
  if (error || !profile) return fail('Account not found.', 404);
  if (profile.date_of_birth == null) return fail(msg('Add your date of birth first.', 'Isi tanggal lahirmu dulu.'));
  if (isTooYoungOn(profile.date_of_birth)) {
    return fail(msg('Accounts are for ages 13 and over. The app still works on your phone without one.', 'Akun untuk usia 13 tahun ke atas. Aplikasi tetap bisa dipakai di HP-mu tanpa akun.'));
  }
  if (!isMinorOn(profile.date_of_birth)) return fail(msg("You're 18 or over, so no approval is needed.", 'Kamu sudah 18 tahun ke atas, jadi tidak perlu persetujuan.'));
  if (profile.consent_approved_at) return json({ ok: true, alreadyApproved: true });
  if (profile.deletion_at) return fail(msg('This account is set to be deleted.', 'Akun ini dijadwalkan untuk dihapus.'));

  const parentEmail = String(body.parentEmail ?? profile.parent_email ?? '').trim().toLowerCase();
  if (!isEmail(parentEmail)) return fail(msg("Enter your parent or guardian's email.", 'Isi email orang tua atau walimu.'));
  const key = parentKey(parentEmail);
  if (key === parentKey(user.email ?? '')) return fail(msg('Use a different email from your own.', 'Pakai email yang beda dari emailmu.'));

  // A "no" from a parent is final for that address; the child can name someone else.
  const { count: declined } = await db.from('consent_requests').select('token_hash', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('parent_key', key).eq('approved', false);
  if ((declined ?? 0) > 0) {
    return fail(msg('That parent or guardian said no. If someone else should decide, use their email address instead.',
      'Orang tua atau wali itu tidak menyetujui. Kalau orang lain yang harus memutuskan, pakai alamat email mereka.'), 409);
  }

  const token = randomToken();
  const tokenHash = await sha256(token);
  const { data: taken, error: takeErr } = await db.rpc('consent_take', {
    p_user: user.id, p_parent_email: parentEmail, p_parent_key: key, p_token_hash: tokenHash,
    p_user_limit: MAX_PER_CHILD_PER_DAY, p_parent_limit: MAX_PER_PARENT_PER_DAY,
    p_global_limit: MAX_PER_DAY_IN_TOTAL, p_gap_seconds: MIN_GAP_SECONDS,
  });
  if (takeErr) throw takeErr;
  if (taken !== 'ok') {
    const [en, id] = REFUSALS[taken as string] ?? ['Try again later.', 'Coba lagi nanti.'];
    return fail(msg(en, id), 429);
  }

  try {
    const mail = consentEmail(user.email ?? 'A student', appLink({ consent: token }));
    await sendEmail(parentEmail, mail.subject, mail.paragraphs, mail.button);
  } catch (e) {
    // The row stays (it still counts for the one-minute gap) but is marked failed so it doesn't use up the daily limits,
    // and the profile is not told a request went out.
    console.error(e instanceof Error ? e.message : String(e));
    await db.from('consent_requests').update({ failed_at: new Date().toISOString() }).eq('token_hash', tokenHash);
    return fail(msg("Couldn't send the email. Check the address and try again.", 'Email tidak bisa dikirim. Periksa alamatnya dan coba lagi.'), 502);
  }

  const { error: saveErr } = await db.from('profiles').update({ parent_email: parentEmail }).eq('id', user.id);
  if (saveErr) throw saveErr;
  return json({ ok: true, parentEmail });
});
