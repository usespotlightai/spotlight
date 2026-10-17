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

const MAX_TEXT_CHARS = 2_000;

const MAX_LINES = 20;

const MAX_LINE_CHARS = 200;

const MAX_NAME_CHARS = 100;

const MAX_PATH_CHARS = 500;

const MAX_HEADER_CHARS = 200;

const ITEM_OVERHEAD = 64;

const clipped = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max)} …` : text;

const clippedStep = (seen: SeenStep): SeenStep => ({
  index: seen.index,
  kind: clipped(seen.kind, MAX_NAME_CHARS),
  tool: seen.tool === null ? null : clipped(seen.tool, MAX_NAME_CHARS),
  text: clipped(seen.text, MAX_TEXT_CHARS),
});

const clippedHunk = (seen: SeenHunk): SeenHunk => ({
  id: seen.id,
  path: clipped(seen.path, MAX_PATH_CHARS),
  header: clipped(seen.header, MAX_HEADER_CHARS),
  lines: seen.lines
    .slice(0, MAX_LINES)
    .map((line) => clipped(line, MAX_LINE_CHARS)),
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
      unique(input.steps, (each) => String(each.index)).map(clippedStep),
      unique(input.hunks, (each) => each.id).map(clippedHunk),
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

  within(max: number): SeenEvidence {
    let used = 0;
    const fits = (size: number): boolean => {
      if (used + size > max) {
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
