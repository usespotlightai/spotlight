import { InvalidRubricScaleError } from '@shared-kernel/domain/exceptions/invalid-rubric-scale.error';

export type RubricScaleKind = 'yes-no' | 'number';

const FENCE = '---';

const SCALE_LINE = /^scores\s*:\s*(.*)$/i;

const NAMED: ReadonlyMap<string, RubricScaleKind> = new Map([
  ['yes-no', 'yes-no'],
  ['1-5', 'number'],
]);

interface ParsedRubric {
  readonly named: string | null;
  readonly body: string;
}

const scaleNamedOn = (line: string | undefined): string | null => {
  const named = line === undefined ? undefined : SCALE_LINE.exec(line)?.[1];

  return named === undefined ? null : named.trim().toLowerCase();
};

const bodyAfter = (lines: readonly string[], at: number): string =>
  lines
    .slice(at + 1)
    .join('\n')
    .trim();

const parsed = (rubric: string): ParsedRubric => {
  const lines = rubric.split('\n');
  const start = lines.findIndex((each) => each.trim());
  const first = lines[start]?.trim();

  if (first === FENCE) {
    const closing = lines.findIndex(
      (each, at) => at > start && each.trim() === FENCE,
    );

    if (closing < 0) {
      throw new InvalidRubricScaleError(
        `has front matter closed by a "${FENCE}" line`,
      );
    }

    const named = lines
      .slice(start + 1, closing)
      .map((each) => scaleNamedOn(each.trim()))
      .find((each) => each !== null);

    return { named: named ?? null, body: bodyAfter(lines, closing) };
  }

  const named = scaleNamedOn(first);

  return named === null
    ? { named, body: rubric.trim() }
    : { named, body: bodyAfter(lines, start) };
};

export class RubricScale {
  private constructor(readonly kind: RubricScaleKind) {}

  static of(rubric: string): RubricScale {
    const { named } = parsed(rubric);

    if (named === null) {
      return new RubricScale('yes-no');
    }

    const kind = NAMED.get(named);

    if (!kind) {
      throw new InvalidRubricScaleError(
        `is named on the rubric's first line or in its front matter as "scores: yes-no" or "scores: 1-5", not "scores: ${named}"`,
      );
    }

    return new RubricScale(kind);
  }

  static bodyOf(rubric: string): string {
    return parsed(rubric).body;
  }

  static readable(rubric: string): RubricScale | null {
    try {
      return RubricScale.of(rubric);
    } catch (error) {
      if (error instanceof InvalidRubricScaleError) {
        return null;
      }
      throw error;
    }
  }
}
