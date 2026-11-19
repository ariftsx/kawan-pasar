import { describe, expect, it } from 'vitest';
import {
  alertsMessage,
  codeMessage,
  helpMessage,
  stoppedMessage,
  weeklyMessage,
} from '../../src/modules/whatsapp/messages.js';

const SITE = 'http://127.0.0.1:8080/';
const FORBIDDEN = /\b(sebaiknya|segera beli|jual sekarang|pasti|karena)\b/i;

describe('WhatsApp messages', () => {
  it('the code message carries the code and a warning not to share it', () => {
    const m = codeMessage('042917');
    expect(m).toContain('042917');
    expect(m).toMatch(/Jangan berikan kode ini/);
  });

  it('alerts: one message for several news items, with links, capped at five, with STOP', () => {
    const items = Array.from({ length: 7 }, (_, i) => ({
      title: `Kabar ${String(i + 1)}`,
      body: 'Rp 40.300/kg di Pasar Kramat Jati.',
      link: '/harga/bawang-merah',
    }));
    const m = alertsMessage(items, SITE);
    expect(m.startsWith('Kawan Pasar 🌶️')).toBe(true);
    expect(m).toContain('• Kabar 1');
    expect(m).toContain('Lihat detail → http://127.0.0.1:8080/harga/bawang-merah');
    expect(m).not.toContain('Kabar 6');
    expect(m).toContain('dan 2 kabar lain di http://127.0.0.1:8080/peringatan');
    expect(m.endsWith('Balas STOP untuk berhenti.')).toBe(true);
    expect(m).not.toMatch(FORBIDDEN);
  });

  it('weekly, stopped and help messages say how to continue or stop', () => {
    expect(
      weeklyMessage('Ringkasan mingguan · 23 Nov 2026', 'Bawang merah: Rp 40.300/kg.', SITE),
    ).toMatch(/bukan jaminan harga[\s\S]*Balas STOP/);
    expect(stoppedMessage(SITE)).toMatch(/verifikasi ulang/);
    expect(helpMessage(SITE)).toMatch(/Balas STOP/);
  });
});
