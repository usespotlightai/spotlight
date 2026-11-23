import {
  offerCouldServe,
  poolCouldTake,
  poolFits,
} from '@runs/domain/services/pool-fit';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunningImage } from '@shared-kernel/domain/value-objects/running-image.vo';
import { describe, expect, it } from 'vitest';

const labels = RunnerOffer.of(['linux', 'gpu']);

describe('poolCouldTake', () => {
  it('takes a run placed anywhere', () => {
    expect(poolCouldTake(RunnerPlacement.anywhere(), labels)).toBe(true);
  });

  it('takes a run placed on a label the pool carries', () => {
    expect(poolCouldTake(RunnerPlacement.of(['gpu']), labels)).toBe(true);
  });

  it('does not take a run placed on a label the pool does not carry', () => {
    expect(poolCouldTake(RunnerPlacement.of(['vpc-internal']), labels)).toBe(
      false,
    );
  });

  it('takes a run that requests an image, which the runner it provisions is started in', () => {
    const image = RunnerImage.of('ghcr.io/acme/widgets:1');

    expect(poolCouldTake(RunnerPlacement.anywhere().in(image), labels)).toBe(
      true,
    );
    expect(poolCouldTake(RunnerPlacement.of(['gpu']).in(image), labels)).toBe(
      true,
    );
    expect(
      poolCouldTake(RunnerPlacement.of(['vpc-internal']).in(image), labels),
    ).toBe(false);
  });

  it('takes a run that requests an image however the pool’s labels say they run', () => {
    expect(
      poolCouldTake(
        RunnerPlacement.anywhere().in(RunnerImage.of('ghcr.io/acme/widgets:1')),
        labels.runningIn(
          RunningImage.of(RunnerImage.of('ghcr.io/acme/gadgets:1'), false),
        ),
      ),
    ).toBe(true);
  });

  it('takes a run only when every label group of its placement matches', () => {
    expect(
      poolCouldTake(
        RunnerPlacement.ofLabelGroups([['gpu'], ['vpc-internal']]),
        labels,
      ),
    ).toBe(false);
    expect(
      poolCouldTake(
        RunnerPlacement.ofLabelGroups([['gpu'], ['vpc-internal', 'linux']]),
        labels,
      ),
    ).toBe(true);
  });
});

describe('poolFits', () => {
  const MAIN = RunnerImage.of('ghcr.io/acme/runner:main');
  const WIDGETS = RunnerImage.of('ghcr.io/acme/widgets:1');
  const RUN = { secrets: false, reviewWork: false };
  const offer = {
    labels,
    egress: false,
    images: null,
    allowsSecrets: true,
    allowsReviewWork: true,
  };

  it('fits work that asks for an image the offer names, or for no image', () => {
    const naming = { ...offer, images: [MAIN] };

    expect(poolFits(RunnerPlacement.anywhere().in(MAIN), naming, RUN)).toBe(
      true,
    );
    expect(poolFits(RunnerPlacement.anywhere(), naming, RUN)).toBe(true);
    expect(poolFits(RunnerPlacement.anywhere().in(WIDGETS), naming, RUN)).toBe(
      false,
    );
  });

  it('fits work that asks for any image when the offer names no images', () => {
    expect(poolFits(RunnerPlacement.anywhere().in(WIDGETS), offer, RUN)).toBe(
      true,
    );
  });

  it('fits work that injects secrets only with egress, and only when the operator allows it', () => {
    const secrets = { secrets: true, reviewWork: false };

    expect(poolFits(RunnerPlacement.anywhere(), offer, secrets)).toBe(false);
    expect(
      poolFits(RunnerPlacement.anywhere(), { ...offer, egress: true }, secrets),
    ).toBe(true);
    expect(
      poolFits(
        RunnerPlacement.anywhere(),
        { ...offer, egress: true, allowsSecrets: false },
        secrets,
      ),
    ).toBe(false);
    expect(
      offerCouldServe(
        RunnerPlacement.anywhere(),
        { ...offer, egress: true, allowsSecrets: false },
        secrets,
      ),
    ).toBe(true);
  });

  it('fits a check or a diff only when the operator allows review work', () => {
    const check = { secrets: false, reviewWork: true };

    expect(poolFits(RunnerPlacement.anywhere(), offer, check)).toBe(true);
    expect(
      poolFits(
        RunnerPlacement.anywhere(),
        { ...offer, allowsReviewWork: false },
        check,
      ),
    ).toBe(false);
  });
});
