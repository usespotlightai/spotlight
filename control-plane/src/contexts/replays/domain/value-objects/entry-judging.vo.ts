import type { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';

export const UNJUDGED_BECAUSE = [
  'unavailable',
  'unreadable-rubric',
  'no-evidence',
  'refused',
  'unreadable',
  'ungrounded',
  'errored',
  'interrupted',
  'stopped-before-judging',
] as const;

export type Unjudged = (typeof UNJUDGED_BECAUSE)[number];

const unjudgedOf = (why: string): Unjudged =>
  (UNJUDGED_BECAUSE as readonly string[]).includes(why)
    ? (why as Unjudged)
    : 'errored';

export class EntryJudging {
  private constructor(
    readonly verdict: JudgeVerdict | null,
    readonly unjudged: Unjudged | null,
  ) {}

  static asked(): EntryJudging {
    return new EntryJudging(null, null);
  }

  static judged(verdict: JudgeVerdict): EntryJudging {
    return new EntryJudging(verdict, null);
  }

  static failed(why: string): EntryJudging {
    return new EntryJudging(null, unjudgedOf(why));
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
