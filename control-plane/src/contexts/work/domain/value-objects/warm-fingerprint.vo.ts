import type { LineMap } from '@work/domain/value-objects/line-map.vo';

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export class WarmFingerprint {
  private readonly kind = 'warm-fingerprint';

  private constructor(readonly value: string) {}

  static of(raw: string): WarmFingerprint {
    return new WarmFingerprint(raw);
  }

  static ofLine(line: LineMap): WarmFingerprint {
    const placement = line.runsIn;

    return new WarmFingerprint(
      JSON.stringify({
        repositories: line.repositories.entries
          .map((each) => ({
            repository: each.repository.value,
            setup: each.setup?.trim() || null,
          }))
          .sort((a, b) => byText(a.repository, b.repository)),
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
