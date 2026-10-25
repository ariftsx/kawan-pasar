import 'fake-indexeddb/auto';

import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';

import { IdbPlanningRepository, newMenuId } from './repository';

import type { GuestMenu } from './schema';

let counter = 0;
function freshRepository(): { repo: IdbPlanningRepository; name: string } {
  counter += 1;
  const name = `test-db-${String(counter)}`;
  return { repo: new IdbPlanningRepository(name), name };
}

function menu(overrides: Partial<GuestMenu> = {}): GuestMenu {
  return {
    id: newMenuId(),
    name: 'Ayam Geprek + Nasi',
    template: 'ayam-geprek-nasi',
    portions_per_day: 100,
    sell_price_idr: 15_000,
    recipe: [{ ingredient: 'cabai-merah-keriting', qty: 40, unit: 'g' }],
    updated_at: '2026-10-26T08:00:00.000Z',
    ...overrides,
  };
}

describe('IdbPlanningRepository', () => {
  it('starts empty', async () => {
    const { repo } = freshRepository();
    await expect(repo.load()).resolves.toEqual({ warung: null, menus: [] });
  });

  it('keeps the warung and menus across instances (survives a reload)', async () => {
    const { repo, name } = freshRepository();
    await repo.saveWarung({ warung_type: 'geprek', created_at: '2026-10-26T08:00:00.000Z' });
    await repo.saveMenu(menu({ name: 'Pecel Lele' }));
    await repo.saveMenu(menu({ name: 'Ayam Geprek' }));

    const again = await new IdbPlanningRepository(name).load();
    expect(again.warung?.warung_type).toBe('geprek');
    expect(again.menus.map((item) => item.name)).toEqual(['Ayam Geprek', 'Pecel Lele']);
  });

  it('rejects an invalid menu instead of storing it', async () => {
    const { repo } = freshRepository();
    await expect(repo.saveMenu(menu({ portions_per_day: -1 }))).rejects.toThrow();
    await expect(repo.saveMenu(menu({ id: 'not-an-id' }))).rejects.toThrow();
  });

  it('skips stored records that no longer validate', async () => {
    const { repo, name } = freshRepository();
    await repo.saveMenu(menu());
    const raw = await openDB(name);
    await raw.put('menus', { id: 'mnu_broken', name: '' });
    await raw.put('warung', { warung_type: 'BAD' }, 'current');
    raw.close();

    const loaded = await new IdbPlanningRepository(name).load();
    expect(loaded.menus).toHaveLength(1);
    expect(loaded.warung).toBeNull();
  });

  it('updates and deletes a menu by id', async () => {
    const { repo } = freshRepository();
    const item = menu();
    await repo.saveMenu(item);
    await repo.saveMenu({ ...item, portions_per_day: 40 });
    expect((await repo.load()).menus.map((m) => m.portions_per_day)).toEqual([40]);
    await repo.deleteMenu(item.id);
    expect((await repo.load()).menus).toEqual([]);
  });

  it('exports everything as versioned JSON (ONB-03)', async () => {
    const { repo } = freshRepository();
    await repo.saveWarung({ warung_type: 'warteg', created_at: '2026-10-26T08:00:00.000Z' });
    await repo.saveMenu(menu());
    const exported = await repo.exportAll(new Date('2026-10-26T09:00:00.000Z'));
    expect(exported).toMatchObject({
      format: 'kawan-pasar-guest-export',
      schema_version: 1,
      exported_at: '2026-10-26T09:00:00.000Z',
      warung: { warung_type: 'warteg' },
    });
    expect(exported.menus).toHaveLength(1);
  });

  it('clears all guest data', async () => {
    const { repo } = freshRepository();
    await repo.saveWarung({ warung_type: 'padang', created_at: '2026-10-26T08:00:00.000Z' });
    await repo.saveMenu(menu());
    await repo.clear();
    await expect(repo.load()).resolves.toEqual({ warung: null, menus: [] });
  });

  it('mints prefixed ULIDs for menus', () => {
    expect(newMenuId()).toMatch(/^mnu_[0-9A-HJKMNP-TV-Z]{26}$/);
  });
});
