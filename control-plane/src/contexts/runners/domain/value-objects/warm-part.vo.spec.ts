import { WarmPart } from '@runners/domain/value-objects/warm-part.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunningImage } from '@shared-kernel/domain/value-objects/running-image.vo';
import { describe, expect, it } from 'vitest';

const IMAGE = RunnerImage.of('ghcr.io/acme/node:22');

const partOf = (
  checkouts: readonly { path: string; setup: string | null }[],
  fingerprint = 'fingerprint_1',
) =>
  WarmPart.of({
    lineId: LineId.of('line_1'),
    placement: RunnerPlacement.of(['gpu']).in(IMAGE),
    checkouts,
    fingerprint,
  });

describe('WarmPart', () => {
  it('trims each path and setup, and keeps no setup that is blank', () => {
    expect(
      partOf([
        { path: ' widgets ', setup: '  npm ci ' },
        { path: 'api', setup: '   ' },
        { path: 'docs', setup: null },
      ]).checkouts,
    ).toEqual([
      { path: 'widgets', setup: 'npm ci' },
      { path: 'api', setup: null },
      { path: 'docs', setup: null },
    ]);
  });

  it('refuses no checkouts, a blank path, two checkouts at one path, or no fingerprint', () => {
    expect(() => partOf([])).toThrow(InconsistentStateError);
    expect(() => partOf([{ path: ' ', setup: null }])).toThrow(
      InconsistentStateError,
    );
    expect(() =>
      partOf([
        { path: 'widgets', setup: null },
        { path: ' widgets', setup: 'npm ci' },
      ]),
    ).toThrow(InconsistentStateError);
    expect(() => partOf([{ path: 'widgets', setup: null }], ' ')).toThrow(
      InconsistentStateError,
    );
  });

  it('fits an offer that has its labels and runs its image', () => {
    const part = partOf([{ path: 'widgets', setup: null }]);

    expect(part.image).toEqual(IMAGE);
    expect(
      part.fits(
        RunnerOffer.of(['gpu', 'linux']).runningIn(
          RunningImage.of(IMAGE, false),
        ),
      ),
    ).toBe(true);
    expect(
      part.fits(
        RunnerOffer.of(['linux']).runningIn(RunningImage.of(IMAGE, false)),
      ),
    ).toBe(false);
    expect(
      part.fits(
        RunnerOffer.of(['gpu']).runningIn(
          RunningImage.of(RunnerImage.of('ghcr.io/acme/other:1'), true),
        ),
      ),
    ).toBe(false);
    expect(part.isFor(LineId.of('line_1'))).toBe(true);
    expect(part.isFor(LineId.of('line_2'))).toBe(false);
  });
});
