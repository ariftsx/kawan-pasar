import { TokenSchema } from '@kawan-pasar/contracts/auth';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button } from '@/components/atoms/Button';
import {
  ChangePasswordForm,
  DeleteAccountForm,
  PhoneForms,
  ResendVerificationForm,
  RevokeSessionForm,
} from '@/components/organisms/auth/AccountForms';
import { PageContainer } from '@/components/templates/SiteShell';
import {
  changePasswordAction,
  deleteAccountAction,
  logoutAction,
  removePhoneAction,
  resendVerificationAction,
  revokeSessionAction,
  setPhoneAction,
} from '@/lib/auth/actions';
import { alertsApi, authApi } from '@/lib/auth/api';
import { SESSION_COOKIE } from '@/lib/auth/cookie';
import { formatDateWib } from '@/lib/format';
import { accountHrefs } from '@/lib/hrefs';

export const metadata: Metadata = { title: 'Akun saya' };

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section
      aria-labelledby={`${id}-title`}
      id={id}
      className="flex scroll-mt-28 flex-col gap-4 rounded-xl border border-line bg-surface p-5 sm:p-6"
    >
      <h2 id={`${id}-title`} className="text-heading-title-20">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function AccountPage(): Promise<ReactNode> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? '';
  if (!TokenSchema.safeParse(token).success) redirect(accountHrefs.signIn());
  const [me, sessions, unread] = await Promise.all([
    authApi.me(token),
    authApi.sessions(token),
    alertsApi.unreadCount(token),
  ]);
  if (!me.ok && me.code === 'unauthenticated') redirect(accountHrefs.notice('sesi-berakhir'));
  if (!me.ok || !sessions.ok) {
    return (
      <PageContainer className="py-10">
        <p role="alert" className="text-body-medium-15">
          Akun Anda belum bisa dimuat. Coba lagi beberapa saat lagi.
        </p>
      </PageContainer>
    );
  }
  const { email, emailVerified, createdAt, csrf, phone } = me.data;
  return (
    <PageContainer className="flex flex-col gap-6 py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-overline-11 text-muted-text uppercase">Akun</p>
          <h1 className="text-heading-h2-32 text-balance">Akun saya</h1>
        </div>
        <form action={logoutAction}>
          <input type="hidden" name="csrf" value={csrf} />
          <Button type="submit" variant="secondary">
            Keluar
          </Button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section id="profil" title="Email">
          <p className="text-body-medium-15 break-all">{email}</p>
          {emailVerified ? (
            <p className="text-body-small-13 text-green-700">✓ Terverifikasi</p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-body-small-13 text-ink-2">
                Belum terverifikasi. Peringatan harga baru dikirim setelah email Anda terverifikasi.
              </p>
              <ResendVerificationForm action={resendVerificationAction} csrf={csrf} />
            </div>
          )}
          <p className="text-body-small-13 text-muted-text">
            Terdaftar sejak {formatDateWib(createdAt.slice(0, 10), 'long')}
          </p>
        </Section>

        <Section id="peringatan" title="Peringatan">
          <p className="text-body-medium-15">
            {unread.ok && unread.data.unread > 0
              ? `${String(unread.data.unread)} kabar belum dibaca.`
              : 'Tidak ada kabar baru.'}
          </p>
          <div>
            <Button href="/peringatan" variant="secondary" size="S">
              Buka Peringatan
            </Button>
          </div>
        </Section>

        <Section id="hp" title="Nomor HP">
          <PhoneForms
            setAction={setPhoneAction}
            removeAction={removePhoneAction}
            csrf={csrf}
            masked={phone}
          />
        </Section>

        <Section id="sandi" title="Ganti kata sandi">
          <ChangePasswordForm action={changePasswordAction} csrf={csrf} />
        </Section>

        <Section id="sesi" title="Sesi aktif">
          <ul className="flex flex-col divide-y divide-line">
            {sessions.data.items.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="font-semibold">
                    {s.device}
                    {s.current ? ' · perangkat ini' : ''}
                  </span>
                  <span className="text-body-small-13 text-muted-text">
                    Terakhir aktif {formatDateWib(s.lastSeenAt.slice(0, 10), 'short')}
                  </span>
                </div>
                {s.current ? null : (
                  <RevokeSessionForm
                    action={revokeSessionAction}
                    csrf={csrf}
                    id={s.id}
                    device={s.device}
                  />
                )}
              </li>
            ))}
          </ul>
        </Section>

        <Section id="hapus" title="Hapus akun">
          <DeleteAccountForm action={deleteAccountAction} csrf={csrf} />
        </Section>
      </div>
    </PageContainer>
  );
}
