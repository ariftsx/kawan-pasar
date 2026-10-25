'use client';

import { listWarungTypes, type MenuTemplate } from '@kawan-pasar/catalog';
import { Button, Callout, Card, Chip, NumberStepper, TextField } from '@kawan-pasar/ui';

import type { Choice, Onboarding } from './use-onboarding';

export function StepType({ flow }: { readonly flow: Onboarding }) {
  const types = listWarungTypes();
  const description = types.find((type) => type.slug === flow.warungType)?.description;
  return (
    <Card aria-labelledby="step-type" className="flex flex-col gap-4">
      <h2 id="step-type" className="text-lg font-semibold">
        Warung Anda jenis apa?
      </h2>
      <div className="flex flex-wrap gap-2">
        {types.map((type) => (
          <Chip
            key={type.slug}
            isSelected={flow.warungType === type.slug}
            onChange={() => {
              flow.setWarungType(type.slug);
            }}
          >
            {type.name}
          </Chip>
        ))}
      </div>
      {description === undefined ? null : (
        <p className="text-sm text-text-secondary">{description}</p>
      )}
      <Button
        isDisabled={flow.warungType === null}
        onPress={() => {
          flow.setStep(1);
        }}
        className="self-end"
      >
        Lanjut
      </Button>
    </Card>
  );
}

function TemplateRow({
  template,
  choice,
  onChange,
}: {
  readonly template: MenuTemplate;
  readonly choice: Choice;
  readonly onChange: (change: Partial<Choice>) => void;
}) {
  return (
    <li className="flex flex-wrap items-end justify-between gap-3 rounded-md border border-border-default p-3">
      <Chip
        isSelected={choice.selected}
        onChange={(selected) => {
          onChange({ selected });
        }}
      >
        {template.name}
      </Chip>
      <NumberStepper
        label={`Porsi per hari · ${template.name}`}
        unit="porsi/hari"
        minValue={5}
        maxValue={1000}
        step={5}
        isDisabled={!choice.selected}
        value={choice.portions}
        onChange={(portions) => {
          onChange({ portions: Number.isFinite(portions) ? portions : 1 });
        }}
      />
    </li>
  );
}

export function StepMenus({ flow }: { readonly flow: Onboarding }) {
  return (
    <Card aria-labelledby="step-menu" className="flex flex-col gap-4">
      <h2 id="step-menu" className="text-lg font-semibold">
        Pilih menu dan porsi per hari
      </h2>
      <Callout tone="info" title="Bahan otomatis dipantau">
        Takaran per porsi adalah contoh. Anda bisa mengubahnya nanti di Rincian Menu.
      </Callout>
      <ul className="flex flex-col gap-3">
        {flow.templates.map((template) => (
          <TemplateRow
            key={template.slug}
            template={template}
            choice={flow.choiceFor(template)}
            onChange={(change) => {
              flow.updateChoice(template, change);
            }}
          />
        ))}
      </ul>
      <TextField
        label="Buat menu sendiri (opsional)"
        description="Bahan dan takarannya diisi di Rincian Menu."
        value={flow.customName}
        onChange={flow.setCustomName}
        maxLength={60}
      />
      <div className="flex justify-between gap-2">
        <Button
          variant="secondary"
          onPress={() => {
            flow.setStep(0);
          }}
        >
          Kembali
        </Button>
        <Button
          isDisabled={flow.selectedCount === 0}
          onPress={() => {
            flow.setStep(2);
          }}
        >
          Lanjut ({flow.selectedCount} menu)
        </Button>
      </div>
    </Card>
  );
}

export function StepAlerts({ flow }: { readonly flow: Onboarding }) {
  return (
    <Card aria-labelledby="step-alert" className="flex flex-col gap-4">
      <h2 id="step-alert" className="text-lg font-semibold">
        Peringatan harga
      </h2>
      <p className="text-sm text-text-secondary">
        Peringatan saat harga bergerak di luar kebiasaan akan tersedia setelah fitur akun dan
        notifikasi selesai. Anda bisa melewati langkah ini.
      </p>
      <Callout tone="limitation" title="Data tersimpan di HP ini">
        Tanpa login, menu Anda hanya disimpan di perangkat ini. Anda bisa mengekspornya kapan saja
        dari Rencana Menu.
      </Callout>
      {flow.existingMenus > 0 ? (
        <p className="text-sm text-text-secondary">
          Anda sudah punya {flow.existingMenus} menu. Menu baru akan ditambahkan.
        </p>
      ) : null}
      <div className="flex justify-between gap-2">
        <Button
          variant="secondary"
          onPress={() => {
            flow.setStep(1);
          }}
        >
          Kembali
        </Button>
        <Button isPending={flow.isSaving} onPress={() => void flow.finish()}>
          Lewati & lihat modal
        </Button>
      </div>
    </Card>
  );
}
