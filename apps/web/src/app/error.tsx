'use client';

import { Button, ErrorState } from '@kawan-pasar/ui';

/** Route error boundary (docs 12 §7): a short message and a digest, never a stack trace. */
export default function RouteError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <ErrorState
      title="Halaman ini gagal dimuat"
      description="Coba lagi sebentar lagi."
      {...(error.digest === undefined ? {} : { requestId: error.digest })}
      action={<Button onPress={reset}>Coba lagi</Button>}
    />
  );
}
