import type { ReactNode } from 'react';
import { ConfirmStatus } from '@/components/organisms/admin/ConfirmStatus';
import { UserSearch } from '@/components/organisms/admin/AdminForms';
import { revokeAnalystAction, searchUserAction } from '@/lib/admin/actions';
import { adminContext } from '@/lib/admin/context';

/** Find one account by its exact e-mail; remove the Analyst role (Fase 3B task 4). */
export default async function AdminUsers(): Promise<ReactNode> {
  const { csrf, confirmedUntil } = await adminContext();
  return (
    <section aria-labelledby="pengguna" className="flex max-w-2xl flex-col gap-4">
      <h2 id="pengguna" className="text-heading-title-20">
        Cari pengguna
      </h2>
      <ConfirmStatus confirmedUntil={confirmedUntil} />
      <p className="text-body-small-13 text-ink-2">
        Peran admin hanya bisa diubah dari server (<code>admin:grant</code>). Di sini hanya mencabut
        peran Analis.
      </p>
      <UserSearch
        searchAction={searchUserAction}
        revokeAction={revokeAnalystAction}
        csrf={csrf}
        confirmed={confirmedUntil !== null}
      />
    </section>
  );
}
