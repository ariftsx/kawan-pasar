import type { AuthFailure } from './api';

// User-facing text for account errors. Fixed sentences only: never the input or an API message.

export const PASSWORD_PROBLEM: Record<string, string> = {
  too_short: 'Kata sandi minimal 12 karakter. Kalimat pendek yang mudah Anda ingat sudah cukup.',
  too_long: 'Kata sandi maksimal 128 karakter.',
  breached: 'Kata sandi ini pernah bocor di internet. Pilih kata sandi lain.',
  same_as_email: 'Kata sandi tidak boleh sama dengan email.',
};

const minutes = (seconds: number | undefined): string =>
  seconds === undefined ? 'beberapa' : String(Math.max(1, Math.ceil(seconds / 60)));

/** Message for a failed account call (form-level). */
export function failureMessage(failure: AuthFailure): string {
  switch (failure.code) {
    case 'invalid_credentials':
      return 'Email atau kata sandi salah.';
    case 'locked':
      return `Terlalu banyak percobaan gagal. Coba lagi dalam ${minutes(failure.retryAfter)} menit.`;
    case 'rate_limited':
      return `Terlalu banyak permintaan. Coba lagi dalam ${minutes(failure.retryAfter)} menit.`;
    case 'invalid_token':
      return 'Tautan ini tidak berlaku lagi (kedaluwarsa atau sudah dipakai). Minta tautan baru.';
    case 'csrf':
      return 'Formulir ini sudah kedaluwarsa. Muat ulang halaman, lalu coba lagi.';
    case 'weak_password':
      return PASSWORD_PROBLEM[failure.reason ?? ''] ?? 'Kata sandi belum memenuhi syarat.';
    case 'bad_request':
      return 'Periksa kembali isian yang ditandai.';
    case 'unauthenticated':
      return 'Sesi Anda berakhir. Silakan masuk lagi.';
    case 'conflict':
      return failure.fields?.[0] === 'limit'
        ? 'Batas 20 komoditas pantauan sudah tercapai. Hapus salah satu dulu.'
        : 'Komoditas ini sudah ada di daftar pantauan Anda.';
    case 'not_found':
    case 'unauthorized':
    case 'internal':
    case 'unavailable':
      return 'Layanan akun sedang bermasalah. Coba lagi beberapa saat lagi.';
  }
}

/** Messages shown on /masuk after a redirect (`?pesan=`): only these keys, never free text. */
export const NOTICES = {
  'sandi-diubah': 'Kata sandi berhasil diatur ulang. Silakan masuk dengan kata sandi baru.',
  keluar: 'Anda sudah keluar.',
  'akun-dihapus': 'Akun Anda sudah dihapus. Terima kasih sudah memakai Kawan Pasar.',
  'sesi-berakhir': 'Sesi Anda berakhir. Silakan masuk lagi.',
} as const satisfies Record<string, string>;
