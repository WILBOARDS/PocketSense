// Parent approval, the parts that don't need Deno: the inbox key used for rate limits and the email text.
// Tested in app/src/lib/consent-server.test.ts.

/**
 * One inbox, one key. Lowercases, drops a +tag, and at Gmail also drops dots and treats googlemail.com as gmail.com,
 * so a + or . alias doesn't count as a new address. Other providers keep their dots: they can matter there.
 */
export function parentKey(email: string): string {
  const full = email.trim().toLowerCase();
  const at = full.lastIndexOf('@');
  if (at < 1) return full;
  let local = full.slice(0, at);
  let domain = full.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  const noTag = local.split('+')[0];
  if (noTag) local = noTag;
  if (domain === 'gmail.com') local = local.replace(/\./g, '') || local;
  return `${local}@${domain}`;
}

/** The approval email, in English and Indonesian in one message because we don't know which the parent reads. */
export function consentEmail(childEmail: string, link: string): {
  subject: string;
  paragraphs: string[];
  button: { label: string; url: string };
} {
  return {
    subject: `Approve Pocket Sense for ${childEmail} / Setujui Pocket Sense untuk ${childEmail}`,
    paragraphs: [
      `${childEmail} wants to use Pocket Sense, a spending-awareness app, with an account that keeps their data in sync between their phone and a PC.`,
      "Because they're under 18, we need a parent or guardian to agree first.",
      "Already held: their email address and date of birth, and your email address (to send you this message). If you approve, we also store what they log in the app, on our server: purchases (name, amount, category, wallet and time), income and savings entries, mood tags, their look-back answers, their savings goal, parked items (name, price and shop link) and settings. If you don't approve, none of that is stored: the app keeps working on their phone only.",
      'Ask, the feature that sends questions to an AI service, is only for people 18 or older, so nothing from their account is sent there.',
      "If you didn't expect this email, ignore it. The link works for 14 days.",
      '— Bahasa Indonesia —',
      `${childEmail} ingin memakai Pocket Sense, aplikasi untuk lebih sadar soal pengeluaran, dengan akun yang menyinkronkan datanya antara HP dan PC.`,
      'Karena mereka di bawah 18 tahun, kami perlu persetujuan orang tua atau wali terlebih dahulu.',
      'Yang sudah kami simpan: alamat email dan tanggal lahir mereka, serta alamat email Anda (untuk mengirim pesan ini). Jika Anda setuju, kami juga menyimpan di server kami apa yang mereka catat di aplikasi: pembelian (nama, jumlah, kategori, dompet, dan waktu), catatan pemasukan dan tabungan, tag mood, jawaban tinjauan mereka, target tabungan, barang yang diparkir (nama, harga, dan link toko), dan pengaturan. Jika Anda tidak setuju, semua itu tidak disimpan: aplikasi hanya berjalan di HP mereka.',
      'Fitur Tanya, yang mengirim pertanyaan ke layanan AI, hanya untuk usia 18 tahun ke atas, jadi tidak ada data dari akun mereka yang dikirim ke sana.',
      'Jika Anda tidak merasa mengharapkan email ini, abaikan saja. Link berlaku 14 hari.',
    ],
    button: { label: 'Review and approve / Tinjau dan setujui', url: link },
  };
}
