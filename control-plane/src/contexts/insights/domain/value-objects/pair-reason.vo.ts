import { InvalidScoreError } from '@insights/domain/exceptions/invalid-score.error';

const MAX_REASON_CHARS = 1_000;

const MAX_CITED = 10;

const distinct = (ids: readonly string[]): readonly string[] => [
  ...new Set(ids.map((each) => each.trim()).filter(Boolean)),
];

export class PairReason {
  private constructor(
    readonly text: string,
    readonly runHunks: readonly string[],
    readonly otherHunks: readonly string[],
  ) {}

  static of(input: {
    text: string;
    runHunks: readonly string[];
    otherHunks: readonly string[];
  }): PairReason {
    const text = input.text.trim();
    const runHunks = distinct(input.runHunks);
    const otherHunks = distinct(input.otherHunks);
    const cited = runHunks.length + otherHunks.length;

    if (!text || text.length > MAX_REASON_CHARS) {
      throw new InvalidScoreError(
        `must be 1 to ${MAX_REASON_CHARS} characters`,
        'reason',
      );
    }
    if (cited === 0 || cited > MAX_CITED) {
      throw new InvalidScoreError(
        `must cite 1 to ${MAX_CITED} hunks of the two changes`,
        'reason',
      );
    }

    return new PairReason(text, runHunks, otherHunks);
  }
}
