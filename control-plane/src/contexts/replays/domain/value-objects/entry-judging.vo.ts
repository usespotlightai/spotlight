import { InvalidReplayError } from '@replays/domain/exceptions/invalid-replay.error';
import type { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';

const UNJUDGED_BECAUSE = [
  'unavailable',
  'unreadable-rubric',
  'no-evidence',
  'request-failed',
  'unreadable',
  'ungrounded',
  'errored',
  'interrupted',
  'stopped-before-judging',
] as const;

export type Unjudged = (typeof UNJUDGED_BECAUSE)[number];

export const unjudgedOf = (why: string): Unjudged => {
  const known = UNJUDGED_BECAUSE.find((each) => each === why);

  if (!known) {
    throw new InvalidReplayError(`judging failed with unknown code ${why}`);
  }

  return known;
};

export class EntryJudging {
  private constructor(
    readonly verdict: JudgeVerdict | null,
    readonly unjudged: Unjudged | null,
  ) {}

  static requested(): EntryJudging {
    return new EntryJudging(null, null);
  }

  static judged(verdict: JudgeVerdict): EntryJudging {
    return new EntryJudging(verdict, null);
  }

  static failed(why: Unjudged): EntryJudging {
    return new EntryJudging(null, why);
  }

  get pending(): boolean {
    return this.verdict === null && this.unjudged === null;
  }

  equals(other: EntryJudging): boolean {
    return (
      this.unjudged === other.unjudged &&
      (this.verdict === null
        ? other.verdict === null
        : other.verdict !== null && this.verdict.equals(other.verdict))
    );
  }
}
