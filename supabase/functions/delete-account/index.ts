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
        'Changed your mind? Before then, sign in and tap "Restore my account". Everything synced to your account is kept. Your goal photo is only stored on your phone, so signing out or deleting removes it from that phone.',
        "If you didn't ask for this, sign in and restore your account, then change your password.",
        '— Bahasa Indonesia —',
        `Kamu meminta untuk menghapus akun Pocket Sense-mu. Akun akan dihapus pada ${shortDate(deletionAt)}, bersama semua yang tersinkron ke akun itu.`,
        'Berubah pikiran? Sebelum tanggal itu, masuk lalu ketuk "Pulihkan akunku". Semua yang tersinkron ke akunmu tetap ada. Foto targetmu hanya tersimpan di HP-mu, jadi keluar atau menghapus akun akan menghapusnya dari HP itu.',
        'Kalau bukan kamu yang memintanya, masuk dan pulihkan akunmu, lalu ganti kata sandimu.',
      ], { label: 'Open Pocket Sense / Buka Pocket Sense', url: appLink() });
    } catch (e) {
      // The deletion is still scheduled; the email is only a reminder.
      console.error(e);
    }
  }
  return json({ ok: true, deletionAt: deletionAt.toISOString() });
});
