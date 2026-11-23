import { PlannedChanges } from '@replays/domain/value-objects/planned-changes.vo';
import { describe, expect, it } from 'vitest';

describe('PlannedChanges', () => {
  it('keeps each key once, in order, so a retry of the same plan reads the same', () => {
    expect(
      PlannedChanges.of({
        skills: ['tdd', ' review', 'tdd'],
        secrets: ['B', 'A'],
      }).value,
    ).toEqual({
      secrets: ['A', 'B'],
      skills: ['review', 'tdd'],
      harnessProfiles: [],
      integrations: [],
      hooks: [],
    });
  });

  it('is empty when the plan changes nothing else', () => {
    expect(PlannedChanges.none().isEmpty).toBe(true);
    expect(
      PlannedChanges.of({ hooks: [{ key: 'notify', lines: [], stations: [] }] })
        .isEmpty,
    ).toBe(false);
  });

  it('keeps a hook’s planned match, and refuses a hook changed twice', () => {
    expect(
      PlannedChanges.of({
        hooks: [{ key: 'notify', lines: [], stations: ['review', 'build'] }],
      }).hooks,
    ).toEqual([{ key: 'notify', lines: [], stations: ['build', 'review'] }]);
    expect(() =>
      PlannedChanges.of({
        hooks: [
          { key: 'notify', lines: [], stations: [] },
          { key: 'notify', lines: ['delivery'], stations: [] },
        ],
      }),
    ).toThrow('must change each hook once');
  });

  it('refuses a blank key and a secret name that is not one', () => {
    expect(() =>
      PlannedChanges.of({ hooks: [{ key: ' ', lines: [], stations: [] }] }),
    ).toThrow('must name each changed hook');
    expect(() => PlannedChanges.of({ secrets: ['lower'] })).toThrow();
  });
});
