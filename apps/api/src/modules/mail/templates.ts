import type { MailJob } from './mail.queue.js';

export interface RenderedMail {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const SIGN_OFF = 'Salam,\nKawan Pasar';
const FOOTER =
  'Email ini dikirim otomatis karena ada aktivitas pada akun Kawan Pasar. Mohon jangan dibalas.';

/** Plain paragraphs (first one may carry a link) → text and minimal HTML (no images, no CSS). */
function compose(
  subject: string,
  paragraphs: readonly string[],
  link?: { label: string; url: string },
): RenderedMail {
  const textParts = [...paragraphs];
  if (link !== undefined) textParts.splice(1, 0, `${link.label}:\n${link.url}`);
  const text = [...textParts, SIGN_OFF, FOOTER].join('\n\n');
  const htmlParas = paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`);
  if (link !== undefined) {
    htmlParas.splice(
      1,
      0,
      `<p><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></p>`,
    );
  }
  const html = [
    '<!doctype html><html lang="id"><body>',
    ...htmlParas,
    `<p>${escapeHtml(SIGN_OFF).replace('\n', '<br>')}</p>`,
    `<p><small>${escapeHtml(FOOTER)}</small></p>`,
    '</body></html>',
  ].join('\n');
  return { subject, text, html };
}

function requireToken(job: MailJob): string {
  if (job.token === undefined) throw new Error(`mail template ${job.template} needs a token`);
  return job.token;
}

/**
 * The e-mail for a queued job, or null for the no-op job. Only the link and fixed text: never
 * the recipient's address or any other personal data in the body.
 */
export function renderMail(job: MailJob, siteUrl: string): RenderedMail | null {
  const site = siteUrl.replace(/\/+$/, '');
  switch (job.template) {
    // forgot_password is resolved into reset_password by the worker before rendering (forgot.ts).
    case 'noop':
    case 'forgot_password':
      return null;
    case 'verify_email':
      return compose(
        'Verifikasi email akun Kawan Pasar Anda',
        [
          'Terima kasih sudah mendaftar di Kawan Pasar. Buka tautan berikut untuk memastikan email ini milik Anda. Peringatan harga baru dikirim setelah email terverifikasi.',
          'Tautan berlaku 24 jam dan hanya bisa dipakai sekali. Bila Anda tidak mendaftar, abaikan email ini.',
        ],
        {
          label: 'Verifikasi email',
          url: `${site}/verifikasi-email?t=${encodeURIComponent(requireToken(job))}`,
        },
      );
    case 'reset_password':
      return compose(
        'Atur ulang kata sandi Kawan Pasar',
        [
          'Ada permintaan untuk mengatur ulang kata sandi akun Kawan Pasar dengan email ini.',
          'Tautan berlaku 30 menit dan hanya bisa dipakai sekali. Bila Anda tidak memintanya, abaikan email ini: kata sandi Anda tidak berubah.',
        ],
        {
          label: 'Atur ulang kata sandi',
          url: `${site}/atur-ulang-sandi?t=${encodeURIComponent(requireToken(job))}`,
        },
      );
    case 'already_registered':
      return compose(
        'Anda sudah punya akun Kawan Pasar',
        [
          'Ada yang mencoba mendaftar di Kawan Pasar dengan email ini, padahal email ini sudah terdaftar. Bila itu Anda, silakan masuk. Bila lupa kata sandi, aturlah ulang.',
          'Bila bukan Anda, abaikan email ini. Akun Anda tidak berubah.',
        ],
        { label: 'Lupa kata sandi', url: `${site}/lupa-sandi` },
      );
    case 'password_changed':
      return compose('Kata sandi Kawan Pasar Anda telah diganti', [
        'Kata sandi akun Kawan Pasar dengan email ini baru saja diganti, dan semua sesi lain telah dikeluarkan.',
        `Bila bukan Anda yang menggantinya, segera atur ulang kata sandi di ${site}/lupa-sandi.`,
      ]);
    case 'weekly_summary': {
      const lines = job.lines ?? [];
      if (lines.length === 0) throw new Error('weekly_summary needs lines');
      return compose(
        'Ringkasan mingguan harga pantauan Anda',
        [
          'Ringkasan harga komoditas yang Anda pantau di Kawan Pasar minggu ini:',
          lines.join('\n'),
          `Prediksi adalah estimasi, bukan jaminan harga. Lihat semua kabar di ${site}/peringatan.`,
          'Tidak ingin menerima ringkasan ini lagi? Buka tautan berhenti berlangganan di atas.',
        ],
        {
          label: 'Berhenti menerima ringkasan mingguan',
          url: `${site}/berhenti-ringkasan?t=${encodeURIComponent(requireToken(job))}`,
        },
      );
    }
    case 'admin_sign_in': {
      const [device, at] = job.lines ?? [];
      return compose('Akun admin Kawan Pasar baru saja masuk', [
        `Akun admin Kawan Pasar dengan email ini baru saja masuk: ${device ?? 'perangkat tidak diketahui'}, ${at ?? 'waktu tidak diketahui'}.`,
        `Bila bukan Anda, segera ganti kata sandi di ${site}/akun dan keluarkan semua sesi lain.`,
      ]);
    }
    case 'analyst_approved':
      return compose('Pengajuan peran Analis Anda disetujui', [
        'Akun Kawan Pasar Anda kini berperan Analis. Anda bisa mengunduh data harga dan prediksi (CSV) di Mode Analis.',
        `Buka ${site}/analis untuk mulai. Batas 30 unduhan per jam.`,
      ]);
    case 'analyst_rejected': {
      const note = job.lines?.[0];
      return compose('Pengajuan peran Analis Anda belum disetujui', [
        'Pengajuan peran Analis untuk akun Kawan Pasar Anda belum disetujui.',
        ...(note === undefined ? [] : [`Catatan dari admin: ${note}`]),
        `Anda bisa mengajukan lagi dari halaman akun: ${site}/akun#mode-analis.`,
      ]);
    }
    case 'account_deleted':
      return compose('Akun Kawan Pasar Anda telah dihapus', [
        'Akun Kawan Pasar dengan email ini telah dihapus beserta datanya, sesuai permintaan Anda.',
        'Anda tetap bisa memantau harga tanpa akun kapan saja.',
      ]);
  }
}
