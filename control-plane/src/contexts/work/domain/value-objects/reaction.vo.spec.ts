import { Happening } from '@work/domain/value-objects/happening.vo';
import { Reaction } from '@work/domain/value-objects/reaction.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { describe, expect, it } from 'vitest';

const COMMENTED = Happening.of('github.pull_request.commented');
const REVIEW = StationId.of('station_review');
const SPEC = StationId.of('station_spec');

describe('Reaction', () => {
  it('applies wherever the task stands when it names no station', () => {
    const anywhere = Reaction.of({ happening: COMMENTED, to: REVIEW });

    expect(anywhere.isEverywhere).toBe(true);
    expect(anywhere.appliesAt(REVIEW)).toBe(true);
    expect(anywhere.appliesAt(SPEC)).toBe(true);
  });

  it('applies only where it says when it names a station', () => {
    const fromSpec = Reaction.of({
      happening: COMMENTED,
      from: SPEC,
      to: REVIEW,
    });

    expect(fromSpec.isEverywhere).toBe(false);
    expect(fromSpec.appliesAt(SPEC)).toBe(true);
    expect(fromSpec.appliesAt(REVIEW)).toBe(false);
  });

  it('takes a null from as wherever it stands', () => {
    expect(
      Reaction.of({ happening: COMMENTED, from: null, to: REVIEW })
        .isEverywhere,
    ).toBe(true);
  });

  it('is the same rule as one saying the same thing', () => {
    const one = Reaction.of({ happening: COMMENTED, from: SPEC, to: REVIEW });
    const other = Reaction.of({ happening: COMMENTED, from: SPEC, to: REVIEW });

    expect(one.equals(other)).toBe(true);
  });

  it('is not the same rule as one that starts or ends elsewhere', () => {
    const fromSpec = Reaction.of({
      happening: COMMENTED,
      from: SPEC,
      to: REVIEW,
    });

    expect(
      fromSpec.equals(Reaction.of({ happening: COMMENTED, to: REVIEW })),
    ).toBe(false);
    expect(
      fromSpec.equals(
        Reaction.of({ happening: COMMENTED, from: SPEC, to: SPEC }),
      ),
    ).toBe(false);
    expect(
      fromSpec.equals(
        Reaction.of({
          happening: Happening.of('github.checks.failed'),
          from: SPEC,
          to: REVIEW,
        }),
      ),
    ).toBe(false);
  });
});
