import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  RUN_ENDINGS,
  type RunEnding,
} from '@insights/domain/value-objects/run-ending';
import { RunEndings } from '@insights/infrastructure/acl/run-endings.adapter';
import { RUN_FAILURE_CODES } from '@shared-kernel/domain/value-objects/run-failure-code';
import { describe, expect, it } from 'vitest';

const BACKFILL = readFileSync(
  join(
    __dirname,
    '../../../../../drizzle/20261128163525_backfill_run_fact_left_out.sql',
  ),
  'utf8',
);

const WHEN = /WHEN "(ended_as|failure)" = '([^']+)' THEN '([^']+)'/g;

const backfilled = (ending: RunEnding, failure: string | null): string | null =>
  [...BACKFILL.matchAll(WHEN)].find(
    ([, column, value]) => (column === 'ended_as' ? ending : failure) === value,
  )?.[3] ?? null;

describe('RunEndings', () => {
  const endings = new RunEndings();

  it.each<[RunEnding, string | null, string]>([
    ['failed', 'refused', 'refused'],
    ['failed', 'unprepared', 'setup'],
    ['failed', 'unprovisioned', 'infrastructure'],
    ['exhausted', 'start-gate-unanswered', 'infrastructure'],
    ['exhausted', 'runner-lost', 'infrastructure'],
    ['cancelled', 'cancelled', 'cancelled'],
    ['cancelled', null, 'cancelled'],
  ])(
    'leaves a run that ended %s (%s) out of its station’s signals, as %s',
    (ending, failure, cause) => {
      expect(endings.outsideCauseOf({ ending, failure })).toBe(cause);
    },
  );

  it.each<[RunEnding, string | null]>([
    ['failed', 'exited'],
    ['exhausted', 'timed-out'],
    ['superseded', 'superseded'],
    ['stopped', null],
    ['completed', null],
  ])(
    'keeps a run that ended %s (%s) in its station’s signals',
    (ending, failure) => {
      expect(endings.outsideCauseOf({ ending, failure })).toBeNull();
    },
  );
});

describe('the backfill of run facts stored before Runs classified their endings', () => {
  it('leaves out exactly the runs Runs would leave out', () => {
    for (const ending of RUN_ENDINGS) {
      for (const failure of [null, ...RUN_FAILURE_CODES]) {
        expect(
          backfilled(ending, failure),
          `${ending} ${failure ?? 'no failure'}`,
        ).toBe(new RunEndings().outsideCauseOf({ ending, failure }));
      }
    }
  });
});
