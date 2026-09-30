// Schedules the caller's account for deletion in 7 days and emails them how to undo it.
// The daily erase_deleted_accounts() job does the actual erasing.
// POST with the user's session → { deletionAt }
import { admin, appLink, caller, fail, json, serve, sendEmail, shortDate } from '../_shared/util.ts';

const GRACE_DAYS = 7;

serve(async req => {
  const db = admin();
  const user = await caller(req, db);
  if (!user) return fail('Sign in first.', 401);

  const deletionAt = new Date(Date.now() + GRACE_DAYS * 24 * 3600_000);
  const { error } = await db.from('profiles').update({ deletion_at: deletionAt.toISOString() }).eq('id', user.id);
  if (error) throw error;

  if (user.email) {
    try {
      await sendEmail(user.email, 'Your Pocket Sense account will be deleted', [
        `You asked to delete your Pocket Sense account. It will be erased on ${shortDate(deletionAt)}, together with everything synced to it.`,
        'Changed your mind? Sign in before then and choose "Restore my account". Nothing will be lost.',
        "If you didn't ask for this, sign in and restore your account, then change your password.",
      ], { label: 'Open Pocket Sense', url: appLink() });
    } catch (e) {
      // The deletion is still scheduled; the email is only a reminder.
      console.error(e);
    }
  }
  return json({ ok: true, deletionAt: deletionAt.toISOString() });
});
