import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';
import { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import { describe, expect, it } from 'vitest';

describe('PlannedLine', () => {
  it('keeps the line’s repositories as the plan would apply them', () => {
    const line = PlannedLine.of({
      repositories: [{ name: 'acme/api', image: 'ghcr.io/acme/api:next' }],
      runners: ['gpu'],
    });

    expect(line.repositories).toEqual([
      { name: 'acme/api', image: 'ghcr.io/acme/api:next' },
    ]);
    expect(line.value).toEqual({
      repositories: [{ name: 'acme/api', image: 'ghcr.io/acme/api:next' }],
    });
  });

  it('takes a line with no repositories', () => {
    expect(PlannedLine.of({ repositories: [] }).repositories).toEqual([]);
  });

  it('refuses what names no repositories, or repositories that are not blocks', () => {
    for (const raw of [
      null,
      [],
      {},
      { repositories: 'acme/api' },
      { repositories: ['acme/api'] },
      { repositories: [null] },
    ]) {
      expect(() => PlannedLine.of(raw)).toThrow(InvalidCandidateError);
    }
  });

  it('refuses a line too long to keep', () => {
    expect(() =>
      PlannedLine.of({
        repositories: [{ name: 'acme/api', setup: 'x'.repeat(70_000) }],
      }),
    ).toThrow(InvalidCandidateError);
  });
});
