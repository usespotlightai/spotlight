import type { LineMap } from '@work/domain/value-objects/line-map.vo';

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export class WarmShape {
  private readonly kind = 'warm-shape';

  private constructor(readonly value: string) {}

  static of(raw: string): WarmShape {
    return new WarmShape(raw);
  }

  static ofLine(line: LineMap): WarmShape {
    const placement = line.runsIn;

    return new WarmShape(
      JSON.stringify({
        repositories: line.repositories.entries
          .map((each) => ({
            repository: each.repository.value,
            setup: each.setup,
          }))
          .sort((a, b) => byText(a.repository, b.repository)),
        labelGroups: placement.labelGroups
          .map((group) => [...group].sort(byText))
          .sort((a, b) => byText(a.join(','), b.join(','))),
        image: placement.image?.value ?? null,
      }),
    );
  }

  equals(other: WarmShape): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
