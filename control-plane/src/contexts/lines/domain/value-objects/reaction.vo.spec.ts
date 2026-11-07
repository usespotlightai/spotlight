import { Reaction } from '@lines/domain/value-objects/reaction.vo';
import { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { describe, expect, it } from 'vitest';

const COMMENTED = Happening.of('github.pull_request.commented');
const REVIEW = StationId.of('station_review');
const SPEC = StationId.of('station_spec');

describe('Reaction', () => {
  it('takes a missing from as wherever it is', () => {
    expect(Reaction.of({ happening: COMMENTED, to: REVIEW }).from).toBeNull();
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
