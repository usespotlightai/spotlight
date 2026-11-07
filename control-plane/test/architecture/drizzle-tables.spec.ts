import { describe, expect, it } from 'vitest';
import {
  SNAPSHOT_TABLE_NAMES,
  SNAPSHOT_VERSIONED_TABLES,
} from './drizzle-snapshot';
import { DRIZZLE_TABLES } from './drizzle-tables';

describe('drizzle table index', () => {
  it('finds every table of the latest migration snapshot', () => {
    expect(DRIZZLE_TABLES.map((table) => table.name).sort()).toEqual(
      SNAPSHOT_TABLE_NAMES,
    );
  });

  it('finds every version column of the latest migration snapshot', () => {
    expect(
      DRIZZLE_TABLES.filter((table) => table.versioned)
        .map((table) => table.name)
        .sort(),
    ).toEqual([...SNAPSHOT_VERSIONED_TABLES].sort());
  });
});
