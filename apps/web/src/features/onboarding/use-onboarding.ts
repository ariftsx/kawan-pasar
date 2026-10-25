'use client';

import { listTemplates, type MenuTemplate } from '@kawan-pasar/catalog';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useGuestPlan } from '@/features/planning/guest-plan';
import { newMenuId } from '@/lib/guest-store/repository';

import type { GuestMenu } from '@/lib/guest-store/schema';

export type Choice = { readonly selected: boolean; readonly portions: number };

function fromTemplate(template: MenuTemplate, portions: number, now: string): GuestMenu {
  return {
    id: newMenuId(),
    name: template.name,
    template: template.slug,
    portions_per_day: portions,
    sell_price_idr: template.sell_price_idr,
    recipe: template.recipe,
    updated_at: now,
  };
}

function customMenu(name: string, now: string): GuestMenu {
  return {
    id: newMenuId(),
    name,
    template: null,
    portions_per_day: 30,
    sell_price_idr: null,
    recipe: [],
    updated_at: now,
  };
}

/** State of the 3-step onboarding; templates start selected with their default portions. */
export function useOnboarding() {
  const router = useRouter();
  const { state, saveWarung, saveMenu } = useGuestPlan();
  const [step, setStep] = useState(0);
  const [warungType, setWarungType] = useState<string | null>(null);
  const [choices, setChoices] = useState<ReadonlyMap<string, Choice>>(() => new Map());
  const [customName, setCustomName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const templates = warungType === null ? [] : listTemplates(warungType);
  const choiceFor = (template: MenuTemplate): Choice =>
    choices.get(template.slug) ?? { selected: true, portions: template.portions_per_day };
  const custom = customName.trim();

  return {
    step,
    setStep,
    warungType,
    setWarungType: (slug: string) => {
      setWarungType(slug);
      setChoices(new Map());
    },
    templates,
    choiceFor,
    updateChoice: (template: MenuTemplate, change: Partial<Choice>) => {
      setChoices(new Map(choices).set(template.slug, { ...choiceFor(template), ...change }));
    },
    customName,
    setCustomName,
    selectedCount: templates.filter((t) => choiceFor(t).selected).length + (custom === '' ? 0 : 1),
    existingMenus: state.status === 'ready' ? state.menus.length : 0,
    isSaving,
    finish: async () => {
      if (warungType === null) return;
      setIsSaving(true);
      const now = new Date().toISOString();
      await saveWarung({ warung_type: warungType, created_at: now });
      for (const template of templates) {
        const choice = choiceFor(template);
        if (choice.selected) await saveMenu(fromTemplate(template, choice.portions, now));
      }
      if (custom !== '') await saveMenu(customMenu(custom, now));
      router.push('/');
    },
  };
}

export type Onboarding = ReturnType<typeof useOnboarding>;
