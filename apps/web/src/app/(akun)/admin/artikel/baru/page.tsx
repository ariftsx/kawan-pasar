import type { ReactNode } from 'react';
import { ConfirmStatus } from '@/components/organisms/admin/ConfirmStatus';
import { ArticleEditor } from '@/components/organisms/admin/AdminForms';
import { createArticleAction } from '@/lib/admin/actions';
import { adminContext } from '@/lib/admin/context';
import { IMAGE_ORIGINS } from '@/lib/image-origins';

export default async function NewArticle(): Promise<ReactNode> {
  const { csrf, confirmedUntil } = await adminContext();
  return (
    <section aria-labelledby="baru" className="flex max-w-3xl flex-col gap-4">
      <h2 id="baru" className="text-heading-title-20">
        Artikel baru
      </h2>
      <ConfirmStatus confirmedUntil={confirmedUntil} />
      <p className="text-body-small-13 text-ink-2">
        Disimpan sebagai draf. Terbitkan dari halaman artikel setelah pratinjau.
      </p>
      <ArticleEditor
        action={createArticleAction}
        csrf={csrf}
        confirmed={confirmedUntil !== null}
        article={null}
        imageOrigins={IMAGE_ORIGINS}
      />
    </section>
  );
}
