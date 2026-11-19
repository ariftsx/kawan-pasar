/**
 * WhatsApp texts (Fase 2C). Plain text, as in the prototype bubble ("Kawan Pasar 🌶️", the news,
 * "Lihat detail → …"). Facts only, no buying or selling advice; every message says how to stop.
 */

const HEADER = 'Kawan Pasar 🌶️';
const STOP_HINT = 'Balas STOP untuk berhenti.';
/** WhatsApp shows long texts collapsed; keep messages short. */
const MAX_ITEMS = 5;

export interface NewsLine {
  title: string;
  body: string;
  link: string | null;
}

const site = (url: string): string => url.replace(/\/+$/, '');

export function codeMessage(code: string): string {
  return [
    HEADER,
    `Kode verifikasi WhatsApp Anda: ${code}`,
    'Berlaku 10 menit. Jangan berikan kode ini kepada siapa pun. Bila Anda tidak memintanya, abaikan pesan ini.',
  ].join('\n');
}

export function alertsMessage(items: readonly NewsLine[], siteUrl: string): string {
  const shown = items.slice(0, MAX_ITEMS);
  const lines = shown.map((n) => {
    const link = n.link === null ? '' : `\nLihat detail → ${site(siteUrl)}${n.link}`;
    return `• ${n.title}\n${n.body}${link}`;
  });
  if (items.length > MAX_ITEMS) {
    lines.push(`dan ${String(items.length - MAX_ITEMS)} kabar lain di ${site(siteUrl)}/peringatan`);
  }
  return [HEADER, ...lines, STOP_HINT].join('\n\n');
}

export function weeklyMessage(title: string, body: string, siteUrl: string): string {
  return [
    HEADER,
    title,
    body,
    `Prediksi adalah estimasi, bukan jaminan harga. Semua kabar: ${site(siteUrl)}/peringatan`,
    STOP_HINT,
  ].join('\n\n');
}

export function stoppedMessage(siteUrl: string): string {
  return [
    HEADER,
    'Anda tidak akan menerima pesan WhatsApp dari Kawan Pasar lagi.',
    `Untuk mengaktifkan kembali, buka ${site(siteUrl)}/peringatan dan verifikasi ulang nomor Anda.`,
  ].join('\n');
}

export function helpMessage(siteUrl: string): string {
  return [
    HEADER,
    'Pesan ini dikirim otomatis dan tidak dibaca petugas.',
    `Pengaturan peringatan: ${site(siteUrl)}/peringatan. ${STOP_HINT}`,
  ].join('\n');
}
