'use client';

import { Button } from '@kawan-pasar/ui';
import { useState } from 'react';

/** Destructive action with an explicit second step (docs 10 §8.7). */
export function DeleteMenu({ onDelete }: { readonly onDelete: () => void }) {
  const [isConfirming, setIsConfirming] = useState(false);
  if (!isConfirming) {
    return (
      <Button
        variant="ghost"
        onPress={() => {
          setIsConfirming(true);
        }}
      >
        Hapus menu
      </Button>
    );
  }
  return (
    <div role="group" aria-label="Konfirmasi hapus" className="flex flex-wrap items-center gap-2">
      <span className="text-sm">Hapus menu ini dari perangkat?</span>
      <Button variant="danger" onPress={onDelete}>
        Ya, hapus
      </Button>
      <Button
        variant="secondary"
        onPress={() => {
          setIsConfirming(false);
        }}
      >
        Batal
      </Button>
    </div>
  );
}
