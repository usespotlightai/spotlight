import type { ChecksState } from '@replays/domain/value-objects/change-checks.vo';
import {
  type CheckSkip,
  checkSkipOf,
  NOT_GENERATED,
} from '@replays/domain/value-objects/check-skip';
import type { EntryReason } from '@replays/domain/value-objects/entry-reason';
import type { EntryOutcome } from '@replays/domain/value-objects/replay-outcome.vo';

export interface SkippedChecks {
  readonly skip: CheckSkip;
  readonly runs: number;
}

export interface ReplayChecks {
  readonly ran: number;
  readonly skipped: readonly SkippedChecks[];
}

interface CheckedReplay {
  readonly entries: readonly Pick<EntryOutcome, 'reasons' | 'checks'>[];
}

const CHECKED: ReadonlySet<ChecksState> = new Set(['passed', 'failed']);

const skipOf = (reasons: readonly EntryReason[]): CheckSkip | null => {
  for (const reason of reasons) {
    if (reason.code === 'change-not-generated') {
      return NOT_GENERATED;
    }
    if (reason.code === 'check-skipped') {
      return checkSkipOf(reason.detail);
    }
  }

  return null;
};

export const replayChecksOf = (
  outcomes: readonly CheckedReplay[],
): ReplayChecks => {
  const skipped = new Map<CheckSkip, number>();
  let ran = 0;

  for (const entry of outcomes.flatMap((each) => each.entries)) {
    const skip = skipOf(entry.reasons);

    if (skip) {
      skipped.set(skip, (skipped.get(skip) ?? 0) + 1);
    } else if (entry.checks && CHECKED.has(entry.checks.state)) {
      ran += 1;
    }
  }

  return {
    ran,
    skipped: [...skipped]
      .map(([skip, runs]): SkippedChecks => ({ skip, runs }))
      .sort((one, other) => other.runs - one.runs),
  };
};
