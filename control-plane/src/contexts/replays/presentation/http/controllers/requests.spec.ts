import { ProblemException } from '@platform/http/resources/problem.exception';
import { changedIn } from '@replays/presentation/http/controllers/requests';
import { describe, expect, it } from 'vitest';

const withDefinition = (definition: unknown) => ({
  changed: { integrations: [{ key: 'linear', definition }] },
});

describe('changedIn', () => {
  it('reads each changed integration with its planned definition, or none', () => {
    expect(
      changedIn({
        changed: {
          integrations: [
            { key: 'linear' },
            { key: 'tracker', definition: { integration: 'tracker' } },
          ],
        },
      }).integrations,
    ).toEqual([
      { key: 'linear', definition: null },
      { key: 'tracker', definition: { integration: 'tracker' } },
    ]);
  });

  it('refuses a planned definition that is not an object', () => {
    expect(() => changedIn(withDefinition(['linear']))).toThrow(
      ProblemException,
    );
  });

  it('refuses a planned definition larger than 16 KiB as JSON', () => {
    expect(() =>
      changedIn(withDefinition({ text: 'x'.repeat(16 * 1024) })),
    ).toThrow(ProblemException);
    expect(
      changedIn(withDefinition({ text: 'x'.repeat(1024) })).integrations,
    ).toHaveLength(1);
  });
});
