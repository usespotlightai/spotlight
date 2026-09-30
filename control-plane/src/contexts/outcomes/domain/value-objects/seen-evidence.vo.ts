import type { Citation } from '@outcomes/domain/value-objects/citation.vo';

export interface SeenStep {
  readonly index: number;
  readonly kind: string;
  readonly tool: string | null;
  readonly text: string;
}

export interface SeenHunk {
  readonly id: string;
  readonly path: string;
  readonly header: string;
  readonly lines: readonly string[];
}

const MOST_TEXT_KEPT = 2_000;

const MOST_LINES_KEPT = 20;

const MOST_LINE_KEPT = 200;

const MOST_NAME_KEPT = 100;

const MOST_PATH_KEPT = 500;

const MOST_HEADER_KEPT = 200;

const ITEM_OVERHEAD = 64;

const clipped = (text: string, most: number): string =>
  text.length > most ? `${text.slice(0, most)} …` : text;

const keptStep = (seen: SeenStep): SeenStep => ({
  index: seen.index,
  kind: clipped(seen.kind, MOST_NAME_KEPT),
  tool: seen.tool === null ? null : clipped(seen.tool, MOST_NAME_KEPT),
  text: clipped(seen.text, MOST_TEXT_KEPT),
});

const keptHunk = (seen: SeenHunk): SeenHunk => ({
  id: seen.id,
  path: clipped(seen.path, MOST_PATH_KEPT),
  header: clipped(seen.header, MOST_HEADER_KEPT),
  lines: seen.lines
    .slice(0, MOST_LINES_KEPT)
    .map((line) => clipped(line, MOST_LINE_KEPT)),
});

const sizeOfStep = (step: SeenStep): number =>
  ITEM_OVERHEAD +
  step.kind.length +
  (step.tool?.length ?? 0) +
  step.text.length;

const sizeOfHunk = (hunk: SeenHunk): number =>
  hunk.lines.reduce(
    (sum, line) => sum + line.length,
    ITEM_OVERHEAD + hunk.id.length + hunk.path.length + hunk.header.length,
  );

const unique = <T>(items: readonly T[], keyOf: (item: T) => string): T[] =>
  items.filter(
    (each, at) => items.findIndex((one) => keyOf(one) === keyOf(each)) === at,
  );

export class SeenEvidence {
  private constructor(
    readonly steps: readonly SeenStep[],
    readonly hunks: readonly SeenHunk[],
  ) {}

  static none(): SeenEvidence {
    return new SeenEvidence([], []);
  }

  static of(input: {
    steps: readonly SeenStep[];
    hunks: readonly SeenHunk[];
  }): SeenEvidence {
    return new SeenEvidence(
      unique(input.steps, (each) => String(each.index)).map(keptStep),
      unique(input.hunks, (each) => each.id).map(keptHunk),
    );
  }

  get isEmpty(): boolean {
    return this.steps.length === 0 && this.hunks.length === 0;
  }

  get size(): number {
    return (
      this.steps.reduce((sum, step) => sum + sizeOfStep(step), 0) +
      this.hunks.reduce((sum, hunk) => sum + sizeOfHunk(hunk), 0)
    );
  }

  stepAt(index: number): SeenStep | null {
    return this.steps.find((each) => each.index === index) ?? null;
  }

  hunkOf(id: string): SeenHunk | null {
    return this.hunks.find((each) => each.id === id) ?? null;
  }

  citedBy(citations: readonly Citation[]): SeenEvidence {
    return new SeenEvidence(
      this.steps.filter((step) =>
        citations.some((each) => each.step === step.index),
      ),
      this.hunks.filter((hunk) =>
        citations.some((each) => each.hunk === hunk.id),
      ),
    );
  }

  onlyCitedBy(citations: readonly Citation[]): boolean {
    const cited = this.citedBy(citations);

    return (
      cited.steps.length === this.steps.length &&
      cited.hunks.length === this.hunks.length
    );
  }

  within(most: number): SeenEvidence {
    let used = 0;
    const fits = (size: number): boolean => {
      if (used + size > most) {
        return false;
      }

      used += size;
      return true;
    };

    return new SeenEvidence(
      this.steps.filter((step) => fits(sizeOfStep(step))),
      this.hunks.filter((hunk) => fits(sizeOfHunk(hunk))),
    );
  }
}
