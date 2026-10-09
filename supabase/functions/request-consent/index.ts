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

const REFUSALS: Record<string, [string, number]> = {
  gap: ['Wait a minute before sending another request.', 429],
  user_limit: ['Too many requests today. Try again tomorrow.', 429],
  parent_limit: ['That address already got several requests today. Try again tomorrow.', 429],
  global_limit: ["We can't send more approval emails right now. Try again tomorrow.", 429],
};

serve(async req => {
  const db = admin();
  const user = await caller(req, db);
  if (!user) return fail('Sign in first.', 401);

  const body = await req.json().catch(() => ({}));
  const { data: profile, error } = await db.from('profiles').select('*').eq('id', user.id).single();
  if (error || !profile) return fail('Account not found.', 404);
  if (profile.date_of_birth == null) return fail('Add your date of birth first.');
  if (isTooYoungOn(profile.date_of_birth)) return fail('Accounts are for ages 13 and over. The app still works on your phone without one.');
  if (!isMinorOn(profile.date_of_birth)) return fail("You're 18 or over, so no approval is needed.");
  if (profile.consent_approved_at) return json({ ok: true, alreadyApproved: true });
  if (profile.deletion_at) return fail('This account is set to be deleted.');

  const parentEmail = String(body.parentEmail ?? profile.parent_email ?? '').trim().toLowerCase();
  if (!isEmail(parentEmail)) return fail("Enter your parent or guardian's email.");
  const key = parentKey(parentEmail);
  if (key === parentKey(user.email ?? '')) return fail('Use a different email from your own.');

  // A "no" from a parent is final for that address; the child can name someone else.
  const { data: last } = await db.from('consent_requests').select('approved')
    .eq('user_id', user.id).eq('parent_key', key).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (last?.approved === false) {
    return fail('That parent or guardian said no. If someone else should decide, use their email address instead.', 409);
  }

  const token = randomToken();
  const { data: taken, error: takeErr } = await db.rpc('consent_take', {
    p_user: user.id, p_parent_email: parentEmail, p_parent_key: key, p_token_hash: await sha256(token),
    p_user_limit: MAX_PER_CHILD_PER_DAY, p_parent_limit: MAX_PER_PARENT_PER_DAY,
    p_global_limit: MAX_PER_DAY_IN_TOTAL, p_gap_seconds: MIN_GAP_SECONDS,
  });
  if (takeErr) throw takeErr;
  if (taken !== 'ok') {
    const [message, status] = REFUSALS[taken as string] ?? ['Try again later.', 429];
    return fail(message, status);
  }

  try {
    const mail = consentEmail(user.email ?? 'A student', appLink({ consent: token }));
    await sendEmail(parentEmail, mail.subject, mail.paragraphs, mail.button);
  } catch (e) {
    // The request row stays and counts toward the limits, but the profile is not told a request went out.
    console.error(e instanceof Error ? e.message : String(e));
    return fail("Couldn't send the email. Check the address and try again.", 502);
  }

  const { error: saveErr } = await db.from('profiles').update({ parent_email: parentEmail }).eq('id', user.id);
  if (saveErr) throw saveErr;
  return json({ ok: true, parentEmail });
});
