import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SOURCE_ROOT } from './source-index';

type SnapshotForeignKey = {
  readonly tableFrom: string;
  readonly tableTo: string;
  readonly columnsFrom: readonly string[];
  readonly onDelete: string;
};

type SnapshotTable = {
  readonly name: string;
  readonly columns: Readonly<Record<string, unknown>>;
  readonly foreignKeys: Readonly<Record<string, SnapshotForeignKey>>;
};

const META = join(SOURCE_ROOT, '..', 'drizzle', 'meta');

const latest = readdirSync(META)
  .filter((name) => name.endsWith('_snapshot.json'))
  .sort()
  .reverse()[0] as string;

const tables = Object.values(
  (
    JSON.parse(readFileSync(join(META, latest), 'utf8')) as {
      tables: Readonly<Record<string, SnapshotTable>>;
    }
  ).tables,
);

export const SNAPSHOT_VERSIONED_TABLES: ReadonlySet<string> = new Set(
  tables
    .filter((table) => 'version' in table.columns)
    .map((table) => table.name),
);

export const SNAPSHOT_TABLE_NAMES: readonly string[] = tables
  .map((table) => table.name)
  .sort();

export const SNAPSHOT_FOREIGN_KEYS: readonly SnapshotForeignKey[] =
  tables.flatMap((table) => Object.values(table.foreignKeys));
