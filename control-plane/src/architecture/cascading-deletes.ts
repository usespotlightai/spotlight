import { AGGREGATE_TABLE_NAMES } from './aggregate-versions';
import {
  SNAPSHOT_FOREIGN_KEYS,
  SNAPSHOT_VERSIONED_TABLES,
} from './drizzle-snapshot';
import { tableNamed } from './drizzle-tables';
import type { Violation } from './known-violations';

const CHANGING_ACTIONS = new Set(['cascade', 'set null', 'set default']);

const isAggregateTable = (name: string): boolean =>
  SNAPSHOT_VERSIONED_TABLES.has(name) || AGGREGATE_TABLE_NAMES.has(name);

const rootsOf = (name: string): ReadonlySet<string> =>
  isAggregateTable(name)
    ? new Set([name])
    : new Set(
        SNAPSHOT_FOREIGN_KEYS.filter(
          (key) => key.tableFrom === name && isAggregateTable(key.tableTo),
        ).map((key) => key.tableTo),
      );

const changesAnAggregate = (from: string, to: string): boolean => {
  if (isAggregateTable(from)) {
    return true;
  }

  const roots = rootsOf(from);
  const parentRoots = rootsOf(to);

  return roots.size > 0 && ![...roots].some((root) => parentRoots.has(root));
};

export const cascadingDeleteViolations = (): Violation[] =>
  SNAPSHOT_FOREIGN_KEYS.filter(
    (key) =>
      CHANGING_ACTIONS.has(key.onDelete) &&
      changesAnAggregate(key.tableFrom, key.tableTo),
  ).map((key) => ({
    key: `${key.tableFrom}.${key.columnsFrom.join(',')}: on delete ${key.onDelete} from ${key.tableTo}`,
    at: tableNamed(key.tableFrom)?.file ?? key.tableFrom,
  }));
