// Planning data behind a repository interface (AGENTS §15), so F3 can swap the device store for
// the API after sign-in without touching the screens.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { ulid } from 'ulid';

import {
  GUEST_SCHEMA_VERSION,
  GuestExport,
  GuestMenu,
  GuestWarung,
  type GuestExport as GuestExportData,
  type GuestMenu as GuestMenuData,
  type GuestWarung as GuestWarungData,
} from './schema';

export type PlanningSnapshot = {
  readonly warung: GuestWarungData | null;
  readonly menus: readonly GuestMenuData[];
};

export type PlanningRepository = {
  load(): Promise<PlanningSnapshot>;
  saveWarung(warung: GuestWarungData): Promise<void>;
  saveMenu(menu: GuestMenuData): Promise<void>;
  deleteMenu(id: string): Promise<void>;
  exportAll(now?: Date): Promise<GuestExportData>;
  clear(): Promise<void>;
};

type GuestDb = DBSchema & {
  warung: { key: 'current'; value: GuestWarungData };
  menus: { key: string; value: GuestMenuData };
};

export const GUEST_DB_NAME = 'kawan-pasar-guest';

export function newMenuId(): string {
  return `mnu_${ulid()}`;
}

/** Records that fail validation are skipped rather than crashing the screen. */
function validMenus(rows: readonly unknown[]): GuestMenuData[] {
  return rows.flatMap((row) => {
    const parsed = GuestMenu.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export class IdbPlanningRepository implements PlanningRepository {
  private db: Promise<IDBPDatabase<GuestDb>> | undefined;

  constructor(private readonly name: string = GUEST_DB_NAME) {}

  private open(): Promise<IDBPDatabase<GuestDb>> {
    this.db ??= openDB<GuestDb>(this.name, GUEST_SCHEMA_VERSION, {
      upgrade(db) {
        // Version 1 creates the stores; later versions migrate here, one step at a time.
        db.createObjectStore('warung');
        db.createObjectStore('menus', { keyPath: 'id' });
      },
    });
    return this.db;
  }

  async load(): Promise<PlanningSnapshot> {
    const db = await this.open();
    const [warung, menus] = await Promise.all([db.get('warung', 'current'), db.getAll('menus')]);
    const parsedWarung = GuestWarung.safeParse(warung);
    return {
      warung: parsedWarung.success ? parsedWarung.data : null,
      menus: validMenus(menus).sort((a, b) => a.name.localeCompare(b.name, 'id')),
    };
  }

  async saveWarung(warung: GuestWarungData): Promise<void> {
    const db = await this.open();
    await db.put('warung', GuestWarung.parse(warung), 'current');
  }

  async saveMenu(menu: GuestMenuData): Promise<void> {
    const db = await this.open();
    await db.put('menus', GuestMenu.parse(menu));
  }

  async deleteMenu(id: string): Promise<void> {
    const db = await this.open();
    await db.delete('menus', id);
  }

  async exportAll(now: Date = new Date()): Promise<GuestExportData> {
    const { warung, menus } = await this.load();
    return GuestExport.parse({
      format: 'kawan-pasar-guest-export',
      schema_version: GUEST_SCHEMA_VERSION,
      exported_at: now.toISOString(),
      warung,
      menus,
    });
  }

  async clear(): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(['warung', 'menus'], 'readwrite');
    await Promise.all([tx.objectStore('warung').clear(), tx.objectStore('menus').clear(), tx.done]);
  }
}
