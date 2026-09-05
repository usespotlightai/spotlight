import { Happening } from '@domain/value-objects/happening.vo';
import { Opener } from '@domain/value-objects/opener.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { describe, expect, it } from 'vitest';

const ISSUE_CREATED = Happening.of('linear.issue.created');
const BACKLOG = StationId.of('station_backlog');
const TRIAGE = StationId.of('station_triage');

describe('Opener', () => {
  it('opens a word at a station', () => {
    const opener = Opener.of({ happening: ISSUE_CREATED, to: BACKLOG });

    expect(opener.happening.equals(ISSUE_CREATED)).toBe(true);
    expect(opener.to.equals(BACKLOG)).toBe(true);
  });

  it('is the same rule as one opening the same word in the same place', () => {
    const one = Opener.of({ happening: ISSUE_CREATED, to: BACKLOG });
    const other = Opener.of({ happening: ISSUE_CREATED, to: BACKLOG });

    expect(one.equals(other)).toBe(true);
  });

  it('is not the same rule as one opening elsewhere or another word', () => {
    const opener = Opener.of({ happening: ISSUE_CREATED, to: BACKLOG });

    expect(
      opener.equals(Opener.of({ happening: ISSUE_CREATED, to: TRIAGE })),
    ).toBe(false);
    expect(
      opener.equals(
        Opener.of({
          happening: Happening.of('linear.issue.deleted'),
          to: BACKLOG,
        }),
      ),
    ).toBe(false);
  });
});
