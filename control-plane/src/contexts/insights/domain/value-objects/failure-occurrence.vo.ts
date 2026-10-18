import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';

const RUN = 'run';
const HOOK = 'hook:';

const blank = (text: string): boolean => text.trim().length === 0;

const isSource = (source: string): boolean =>
  source === RUN ||
  (source.startsWith(HOOK) && !blank(source.slice(HOOK.length)));

export class FailureOccurrence {
  private constructor(
    readonly stationId: string,
    readonly runId: string | null,
    readonly source: string,
    readonly code: string,
    readonly occurrences: number,
    readonly at: Date,
  ) {}

  static of(input: {
    stationId: string;
    runId: string | null;
    source: string;
    code: string;
    occurrences: number;
    at: Date;
  }): FailureOccurrence {
    if (!isSource(input.source)) {
      throw new InvalidOutcomeError(
        `failure source must be a run or a named hook, not ${input.source || 'empty'}`,
      );
    }
    if (blank(input.code)) {
      throw new InvalidOutcomeError('failure must say what went wrong');
    }
    if (!Number.isInteger(input.occurrences) || input.occurrences < 1) {
      throw new InvalidOutcomeError('failure must have happened at least once');
    }

    return new FailureOccurrence(
      input.stationId,
      input.runId,
      input.source,
      input.code,
      input.occurrences,
      input.at,
    );
  }

  get fromHook(): boolean {
    return this.source !== RUN;
  }

  sameAs(other: FailureOccurrence): boolean {
    return (
      this.source === other.source &&
      this.code === other.code &&
      this.stationId === other.stationId &&
      this.occurrences === other.occurrences &&
      this.at.getTime() === other.at.getTime()
    );
  }
}
