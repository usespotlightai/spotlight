import { InvalidRubricScaleError } from '@shared-kernel/domain/exceptions/invalid-rubric-scale.error';

export type RubricScaleKind = 'yes-no' | 'number';

const FENCE = '---';

const SCALE_LINE = /^scores\s*:\s*(.*)$/i;

const NAMED: ReadonlyMap<string, RubricScaleKind> = new Map([
  ['yes-no', 'yes-no'],
  ['1-5', 'number'],
]);

const namedIn = (lines: readonly string[]): string | null => {
  const [first, ...rest] = lines;

  if (first === FENCE) {
    const closing = rest.indexOf(FENCE);

    if (closing < 0) {
      throw new InvalidRubricScaleError(
        `has front matter closed by a "${FENCE}" line`,
      );
    }

    for (const line of rest.slice(0, closing)) {
      const named = SCALE_LINE.exec(line)?.[1];

      if (named !== undefined) {
        return named.trim().toLowerCase();
      }
    }

    return null;
  }

  const named = first === undefined ? undefined : SCALE_LINE.exec(first)?.[1];

  return named === undefined ? null : named.trim().toLowerCase();
};

export class RubricScale {
  private constructor(readonly kind: RubricScaleKind) {}

  static of(rubric: string): RubricScale {
    const lines = rubric.split('\n').map((each) => each.trim());
    const named = namedIn(lines.slice(Math.max(0, lines.findIndex(Boolean))));

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
