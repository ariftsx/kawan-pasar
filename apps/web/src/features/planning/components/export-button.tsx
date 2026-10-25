'use client';

import { Button } from '@kawan-pasar/ui';

import { useGuestPlan } from '../guest-plan';

/** ONB-03: guest data leaves the device only when the user downloads it. */
export function ExportButton() {
  const { exportJson } = useGuestPlan();
  const download = async () => {
    const blob = new Blob([await exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kawan-pasar-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Button variant="ghost" onPress={() => void download()}>
      Ekspor data (JSON)
    </Button>
  );
}
