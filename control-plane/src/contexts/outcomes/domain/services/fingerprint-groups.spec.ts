import {
  endedRecord,
  FIRST_CONFIG,
  SECOND_CONFIG,
} from '@outcomes/domain/outcomes.fake-spec';
import { fingerprintGroupsNewestFirst } from '@outcomes/domain/services/fingerprint-groups';
import { describe, expect, it } from 'vitest';

const at = (hour: number) =>
  new Date(`2026-09-30T${String(hour).padStart(2, '0')}:00:00.000Z`);

describe('fingerprintGroupsNewestFirst', () => {
  it('groups consecutive runs of the same config, the newest group first', () => {
    const groups = fingerprintGroupsNewestFirst([
      endedRecord('run_1', { fingerprint: FIRST_CONFIG, endedAt: at(1) }),
      endedRecord('run_4', { fingerprint: FIRST_CONFIG, endedAt: at(4) }),
      endedRecord('run_2', { fingerprint: FIRST_CONFIG, endedAt: at(2) }),
      endedRecord('run_3', { fingerprint: SECOND_CONFIG, endedAt: at(3) }),
    ]);

    expect(
      groups.map((each) => [
        each.fingerprint,
        each.records.map((one) => one.runId.value),
      ]),
    ).toEqual([
      [FIRST_CONFIG, ['run_4']],
      [SECOND_CONFIG, ['run_3']],
      [FIRST_CONFIG, ['run_2', 'run_1']],
    ]);
  });

  it('keeps runs from before configs were fingerprinted in a group of their own', () => {
    const groups = fingerprintGroupsNewestFirst([
      endedRecord('run_1', { fingerprint: null, endedAt: at(1) }),
      endedRecord('run_2', { fingerprint: null, endedAt: at(2) }),
      endedRecord('run_3', { fingerprint: FIRST_CONFIG, endedAt: at(3) }),
    ]);

    expect(groups.map((each) => each.fingerprint)).toEqual([
      FIRST_CONFIG,
      null,
    ]);
  });

  it('has no groups without runs', () => {
    expect(fingerprintGroupsNewestFirst([])).toEqual([]);
  });
});
