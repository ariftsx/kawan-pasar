import { COMMODITIES } from '@kawan-pasar/catalog';
import type { NotificationItem, NotificationTab } from '@kawan-pasar/contracts/alerts';
import { TokenSchema } from '@kawan-pasar/contracts/auth';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Chip } from '@/components/atoms/Chip';
import { StatePanel } from '@/components/molecules/StatePanel';
import {
  AddWatchForm,
  MarkAllReadForm,
  PreferencesForm,
  WatchItem,
} from '@/components/organisms/alerts/AlertForms';
import { PageContainer } from '@/components/templates/SiteShell';
import {
  addWatchAction,
  markAllReadAction,
  removeWatchAction,
  savePreferencesAction,
  updateWatchAction,
} from '@/lib/alerts/actions';
import { alertsApi, authApi } from '@/lib/auth/api';
import { SESSION_COOKIE } from '@/lib/auth/cookie';
import { cx } from '@/lib/cx';
import { formatDateWib } from '@/lib/format';
import { accountHrefs, alertHrefs } from '@/lib/hrefs';

export const metadata: Metadata = { title: 'Peringatan' };

type Search = Promise<Record<string, string | string[] | undefined>>;

const TABS: readonly { tab: NotificationTab; label: string }[] = [
  { tab: 'all', label: 'Semua' },
  { tab: 'unread', label: 'Belum dibaca' },
  { tab: 'weekly', label: 'Ringkasan mingguan' },
];
const SAVED: Record<string, string> = {
  pengaturan: 'Pengaturan peringatan sudah disimpan.',
  pantauan: 'Daftar pantauan sudah diperbarui.',
};

const time = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
});

function NewsItem({ n }: { n: NotificationItem }): ReactNode {
  return (
    <li
      className={cx(
        'flex flex-col gap-1.5 rounded-xl border p-4 sm:p-5',
        n.read ? 'border-line bg-surface' : 'border-kunyit-600 bg-kunyit-100',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {n.read ? null : (
          <Chip tone="kunyit-solid" size="S">
            Baru
          </Chip>
        )}
        <h3 className="text-heading-card-16">{n.title}</h3>
      </div>
      <p className="text-body-small-13 whitespace-pre-line text-ink-2">{n.body}</p>
      <p className="text-[12px] text-muted-text">
        {formatDateWib(n.createdAt, 'short')} · {time.format(new Date(n.createdAt))}
        {n.kind === 'weekly' ? ' · ringkasan mingguan' : ' · di aplikasi'}
      </p>
      {n.link === null ? null : (
        <Link
          href={n.link as Route}
          className="text-body-small-13 font-semibold text-green-900 underline"
        >
          Lihat detail
        </Link>
      )}
    </li>
  );
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Search;
}): Promise<ReactNode> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? '';
  if (!TokenSchema.safeParse(token).success) redirect(accountHrefs.signIn('/peringatan'));
  const params = await searchParams;
  const tab = TABS.find((t) => t.tab === params['tab'])?.tab ?? 'all';
  const before = Number(params['sebelum']);
  const cursor = Number.isSafeInteger(before) && before > 0 ? before : undefined;

  const [me, overview, news] = await Promise.all([
    authApi.me(token),
    alertsApi.overview(token),
    alertsApi.notifications(token, tab, cursor),
  ]);
  if (!me.ok && me.code === 'unauthenticated') redirect(accountHrefs.notice('sesi-berakhir'));
  if (!me.ok || !overview.ok || !news.ok) {
    return (
      <PageContainer className="py-10">
        <p role="alert" className="text-body-medium-15">
          Peringatan belum bisa dimuat. Coba lagi beberapa saat lagi.
        </p>
      </PageContainer>
    );
  }
  const { csrf } = me.data;
  const { preferences, watches, emailVerified } = overview.data;
  const watched = new Set(watches.map((w) => w.commodity.code));
  const options = COMMODITIES.filter((c) => !watched.has(c.code)).map((c) => ({
    value: c.code,
    label: c.name,
  }));
  const saved = typeof params['disimpan'] === 'string' ? SAVED[params['disimpan']] : undefined;

  return (
    <PageContainer className="flex flex-col gap-6 py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-overline-11 text-muted-text uppercase">Peringatan</p>
          <h1 className="text-heading-h2-32 text-balance">Kabar pergerakan harga</h1>
          <p className="text-body-medium-15 max-w-2xl text-ink-2">
            Kami memberi tahu saat harga komoditas yang Anda pantau bergerak di luar kebiasaan.
          </p>
        </div>
        {news.data.unread > 0 ? (
          <MarkAllReadForm action={markAllReadAction} csrf={csrf} tab={tab} />
        ) : null}
      </div>

      {saved === undefined ? null : (
        <p
          role="status"
          className="rounded-lg bg-green-100 px-4 py-3 text-body-small-13 font-semibold"
        >
          {saved}
        </p>
      )}
      {emailVerified ? null : (
        <p className="rounded-lg bg-kunyit-100 px-4 py-3 text-body-small-13">
          Email Anda belum terverifikasi. Pengaturan bisa disiapkan sekarang; kabar baru dikirim
          setelah email terverifikasi (lihat{' '}
          <Link href="/akun" className="font-semibold text-green-900 underline">
            Akun saya
          </Link>
          ).
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="kabar-title" className="flex min-w-0 flex-col gap-4">
          <h2 id="kabar-title" className="sr-only">
            Kabar
          </h2>
          <nav aria-label="Saring kabar" className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <Link
                key={t.tab}
                href={alertHrefs.list(t.tab)}
                aria-current={t.tab === tab ? 'page' : undefined}
                className={cx(
                  'inline-flex min-h-11 items-center rounded-full border px-4 text-[14px] font-semibold',
                  t.tab === tab
                    ? 'border-green-900 bg-green-900 text-surface'
                    : 'border-line bg-surface',
                )}
              >
                {t.label}
                {t.tab === 'unread' ? ` (${String(news.data.unread)})` : ''}
              </Link>
            ))}
          </nav>
          {news.data.items.length === 0 ? (
            <StatePanel
              pose="halo"
              chip="Kosong"
              chipTone="neutral"
              title="Belum ada kabar harga"
              body="Pantau komoditas favorit Anda, dan Kapa akan memberi tahu saat ada pergerakan penting."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {news.data.items.map((n) => (
                <NewsItem key={n.id} n={n} />
              ))}
            </ul>
          )}
          {news.data.next === null ? null : (
            <Link
              href={alertHrefs.list(tab, news.data.next)}
              className="self-start text-body-small-13 font-semibold text-green-900 underline"
            >
              Kabar lebih lama
            </Link>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          <section
            id="pantauan"
            aria-labelledby="pantauan-title"
            className="flex scroll-mt-28 flex-col gap-3 rounded-xl border border-line bg-surface p-5 sm:p-6"
          >
            <h2 id="pantauan-title" className="text-heading-title-20">
              Komoditas yang dipantau
            </h2>
            {watches.length === 0 ? (
              <p className="text-body-small-13 text-ink-2">Belum ada. Pilih komoditas di bawah.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {watches.map((w) => (
                  <WatchItem
                    key={w.id}
                    watch={w}
                    csrf={csrf}
                    updateAction={updateWatchAction}
                    removeAction={removeWatchAction}
                  />
                ))}
              </ul>
            )}
            <AddWatchForm action={addWatchAction} csrf={csrf} options={options} />
          </section>

          <section
            id="pengaturan"
            aria-labelledby="pengaturan-title"
            className="flex scroll-mt-28 flex-col gap-3 rounded-xl border border-line bg-surface p-5 sm:p-6"
          >
            <h2 id="pengaturan-title" className="text-heading-title-20">
              Pengaturan peringatan
            </h2>
            <PreferencesForm action={savePreferencesAction} csrf={csrf} preferences={preferences} />
          </section>
        </div>
      </div>
    </PageContainer>
  );
}
