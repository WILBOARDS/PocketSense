// Used by the parent's approval page in the app. The parent has no account, so this function
// doesn't need a session: the token from the email link is the proof.
// POST { token }                      → { childEmail, parentEmail } to show on the page
// POST { token, decision: 'approve' } → marks the child's profile approved
// POST { token, decision: 'decline' } → records the "no" on every open link for that address; approves nothing
// Every body may carry lang: 'en' | 'id' for the error messages.
import { admin, fail, json, serve, sha256 } from '../_shared/util.ts';

const LINK_DAYS = 14;

serve(async req => {
  const body = await req.json().catch(() => ({}));
  const lang = body.lang === 'id' ? 'id' : 'en';
  const msg = (en: string, id: string) => (lang === 'id' ? id : en);
  const token = typeof body.token === 'string' ? body.token : '';
  if (!token || token.length > 100) return fail(msg('This link is not valid.', 'Link ini tidak valid.'), 404);

  const db = admin();
  const since = new Date(Date.now() - LINK_DAYS * 24 * 3600_000).toISOString();
  const { data: request } = await db.from('consent_requests').select('*')
    .eq('token_hash', await sha256(token)).is('used_at', null).gte('created_at', since).maybeSingle();
  if (!request) {
    return fail(msg('This link has expired or was already used. Ask them to send a new request from the app.',
      'Link ini sudah kedaluwarsa atau sudah dipakai. Minta mereka mengirim permintaan baru dari aplikasi.'), 404);
  }

  const { data: userRes } = await db.auth.admin.getUserById(request.user_id);
  const childEmail = userRes?.user?.email ?? 'your child';

  if (body.decision === undefined) return json({ childEmail, parentEmail: request.parent_email });
  if (body.decision !== 'approve' && body.decision !== 'decline') return fail(msg('Unknown decision.', 'Pilihan tidak dikenal.'));

  const approved = body.decision === 'approve';
  const now = new Date().toISOString();
  const { error: useErr } = await db.from('consent_requests')
    .update({ used_at: now, approved }).eq('token_hash', request.token_hash);
  if (useErr) throw useErr;
  if (!approved) {
    // A "no" covers every link sent to this address for this child, so an older link can't hide it.
    const { error } = await db.from('consent_requests').update({ used_at: now, approved: false })
      .eq('user_id', request.user_id).eq('parent_key', request.parent_key).is('used_at', null);
    if (error) throw error;
  }

  if (approved) {
    const { error } = await db.from('profiles')
      .update({ consent_approved_at: new Date().toISOString(), parent_email: request.parent_email })
      .eq('id', request.user_id);
    if (error) throw error;
  }
  return json({ ok: true, approved, childEmail });
});
