import { WarmFingerprint } from '@runs/domain/value-objects/warm-fingerprint.vo';
import {
  checkoutOf,
  warmLineOf,
} from '@runs/domain/value-objects/warm-line.fake-spec';
import type { WarmCheckout } from '@runs/domain/value-objects/warm-line.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { describe, expect, it } from 'vitest';

const API = checkoutOf('api');
const WIDGETS = checkoutOf('widgets', 'npm ci');

const fingerprintOf = (
  checkouts: readonly WarmCheckout[],
  placement?: RunnerPlacement,
) => WarmFingerprint.ofSetup(warmLineOf({ checkouts, placement }));

describe('WarmFingerprint', () => {
  it('is the same whatever order the line lists its repositories and labels in', () => {
    expect(
      fingerprintOf(
        [WIDGETS, API],
        RunnerPlacement.ofLabelGroups([['gpu', 'linux'], ['eu']]),
      ).equals(
        fingerprintOf(
          [API, WIDGETS],
          RunnerPlacement.ofLabelGroups([['eu'], ['linux', 'gpu']]),
        ),
      ),
    ).toBe(true);
  });

  it('is the same for a setup with blanks around it', () => {
    expect(
      fingerprintOf([checkoutOf('widgets', ' npm ci ')]).equals(
        fingerprintOf([WIDGETS]),
      ),
    ).toBe(true);
  });

  it('changes with a repository, a setup, the labels or the image', () => {
    const base = fingerprintOf([WIDGETS]);

    expect(fingerprintOf([WIDGETS, API]).equals(base)).toBe(false);
    expect(fingerprintOf([checkoutOf('widgets')]).equals(base)).toBe(false);
    expect(
      fingerprintOf([WIDGETS], RunnerPlacement.of(['gpu'])).equals(base),
    ).toBe(false);
    expect(
      fingerprintOf(
        [WIDGETS],
        RunnerPlacement.anywhere().in(RunnerImage.of('ghcr.io/acme/node:22')),
      ).equals(base),
    ).toBe(false);
  });

  it('reads back from its value', () => {
    const fingerprint = fingerprintOf([WIDGETS]);

    expect(WarmFingerprint.of(fingerprint.value).equals(fingerprint)).toBe(
      true,
    );
  });
});
