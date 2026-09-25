import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { RunningImage } from '@shared-kernel/domain/value-objects/running-image.vo';
import { poolCouldTake } from '@work/domain/services/pool-fit';
import { describe, expect, it } from 'vitest';

const labels = RunnerTerms.of(['linux', 'gpu']);

describe('poolCouldTake', () => {
  it('takes a run placed anywhere', () => {
    expect(poolCouldTake(RunnerPlacement.anywhere(), labels)).toBe(true);
  });

  it('takes a run placed on a label the pool carries', () => {
    expect(poolCouldTake(RunnerPlacement.of(['gpu']), labels)).toBe(true);
  });

  it('refuses a run placed on a label the pool does not carry', () => {
    expect(poolCouldTake(RunnerPlacement.of(['vpc-internal']), labels)).toBe(
      false,
    );
  });

  it('takes a run asking for an image, which the runner it provisions is started in', () => {
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

  it('takes a run asking for an image however the pool’s labels say they run', () => {
    expect(
      poolCouldTake(
        RunnerPlacement.anywhere().in(RunnerImage.of('ghcr.io/acme/widgets:1')),
        labels.runningIn(
          RunningImage.of(RunnerImage.of('ghcr.io/acme/gadgets:1'), false),
        ),
      ),
    ).toBe(true);
  });

  it('refuses a run unless every clause of its placement is met', () => {
    expect(
      poolCouldTake(
        RunnerPlacement.ofClauses([['gpu'], ['vpc-internal']]),
        labels,
      ),
    ).toBe(false);
    expect(
      poolCouldTake(
        RunnerPlacement.ofClauses([['gpu'], ['vpc-internal', 'linux']]),
        labels,
      ),
    ).toBe(true);
  });
});
