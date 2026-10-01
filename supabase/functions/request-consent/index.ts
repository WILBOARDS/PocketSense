// Emails a parent or guardian a link to approve syncing for a user under 18.
// POST { parentEmail } with the user's session. Also used for "Resend request" (no body needed then).
import { admin, appLink, caller, fail, isEmail, isMinor, json, randomToken, serve, sendEmail, sha256 } from '../_shared/util.ts';

const MAX_PER_DAY = 5;
const MIN_GAP_MS = 60_000;

serve(async req => {
  const db = admin();
  const user = await caller(req, db);
  if (!user) return fail('Sign in first.', 401);

  const body = await req.json().catch(() => ({}));
  const { data: profile, error } = await db.from('profiles').select('*').eq('id', user.id).single();
  if (error || !profile) return fail('Account not found.', 404);
  if (profile.birth_year == null) return fail('Add your birth year first.');
  if (!isMinor(profile.birth_year)) return fail("You're 18 or over, so no approval is needed.");
  if (profile.consent_approved_at) return json({ ok: true, alreadyApproved: true });
  if (profile.deletion_at) return fail('This account is set to be deleted.');

  const parentEmail = String(body.parentEmail ?? profile.parent_email ?? '').trim().toLowerCase();
  if (!isEmail(parentEmail)) return fail("Enter your parent or guardian's email.");
  if (parentEmail === (user.email ?? '').toLowerCase()) return fail('Use a different email from your own.');

  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: recent } = await db.from('consent_requests').select('created_at')
    .eq('user_id', user.id).gte('created_at', since).order('created_at', { ascending: false });
  if (recent && recent.length >= MAX_PER_DAY) return fail('Too many requests today. Try again tomorrow.', 429);
  if (recent?.[0] && Date.now() - new Date(recent[0].created_at).getTime() < MIN_GAP_MS) {
    return fail('Wait a minute before sending another request.', 429);
  }

  const token = randomToken();
  const { error: insErr } = await db.from('consent_requests')
    .insert({ token_hash: await sha256(token), user_id: user.id, parent_email: parentEmail });
  if (insErr) throw insErr;
  await db.from('profiles').update({ parent_email: parentEmail }).eq('id', user.id);

  try {
    await sendEmail(parentEmail, `${user.email} asked you to approve Pocket Sense`, [
      `${user.email} wants to use Pocket Sense, a spending-awareness app, on both their phone and a PC.`,
      'To do that, their purchases (amount, category, wallet and time), mood tags, savings goal and app settings are stored on our server. The person who runs Pocket Sense can technically see this data.',
      "Because they're under 18, we need a parent or guardian to agree first. Until then, the app only keeps data on their phone.",
      "If you didn't expect this email, you can ignore it. Nothing is stored unless you approve. The link works for 14 days.",
    ], { label: 'Review and approve', url: appLink({ consent: token }) });
  } catch (e) {
    console.error(e);
    return fail("Couldn't send the email. Check the address and try again.", 502);
  }

  return json({ ok: true, parentEmail });
});
