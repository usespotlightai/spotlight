import type { WarmCheckout } from '@runs/domain/value-objects/warm-line.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export class WarmFingerprint {
  private readonly kind = 'warm-fingerprint';

  private constructor(readonly value: string) {}

  static of(raw: string): WarmFingerprint {
    return new WarmFingerprint(raw);
  }

  static ofSetup(setup: {
    readonly checkouts: readonly WarmCheckout[];
    readonly placement: RunnerPlacement;
  }): WarmFingerprint {
    const { placement } = setup;

    return new WarmFingerprint(
      JSON.stringify({
        checkouts: setup.checkouts
          .map((each) => ({
            path: each.path,
            setup: each.setup?.trim() || null,
          }))
          .sort((a, b) => byText(a.path, b.path)),
        labelGroups: placement.labelGroups
          .map((group) => [...group].sort(byText))
          .sort((a, b) => byText(a.join(','), b.join(','))),
        image: placement.image?.value ?? null,
      }),
    );
  }

  equals(other: WarmFingerprint): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
