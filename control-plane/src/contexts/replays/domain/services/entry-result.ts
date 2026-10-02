import { blamesTheCandidate } from '@replays/domain/services/failure-blame';
import type { ChangeChecks } from '@replays/domain/value-objects/change-checks.vo';
import {
  NO_CHECK_ASKED,
  UNDRAFTED,
} from '@replays/domain/value-objects/check-skip';
import type { EntryJudging } from '@replays/domain/value-objects/entry-judging.vo';
import type { EntryMeasures } from '@replays/domain/value-objects/entry-measures.vo';
import {
  type EntryReason,
  reasonOf,
} from '@replays/domain/value-objects/entry-reason';
import type { ReplayRefusal } from '@replays/domain/value-objects/replay-refusal';
import type { RunEnd } from '@replays/domain/value-objects/run-end.vo';

export interface EntryResult {
  readonly succeeded: boolean | null;
  readonly reasons: readonly EntryReason[];
  readonly concluded: boolean;
}

export interface EntryFacts {
  readonly refusal: ReplayRefusal | null;
  readonly notRun: boolean;
  readonly end: RunEnd | null;
  readonly measures: EntryMeasures | null;
  readonly checks: ChangeChecks | null;
  readonly judging: EntryJudging | null;
}

export interface Scoring {
  readonly judges: boolean;
  readonly checks: boolean;
}

type Part =
  | { readonly kind: 'pending' }
  | { readonly kind: 'absent' }
  | {
      readonly kind: 'passed' | 'failed' | 'unscored';
      readonly reasons: readonly EntryReason[];
    };

const PENDING: Part = { kind: 'pending' };

const ABSENT: Part = { kind: 'absent' };

const ended = (
  succeeded: boolean | null,
  ...reasons: EntryReason[]
): EntryResult => ({ succeeded, reasons, concluded: true });

const unstacked = (checked: boolean, measures: EntryMeasures | null): Part => {
  if (!checked) {
    return ABSENT;
  }
  if (!measures) {
    return PENDING;
  }

  return {
    kind: 'unscored',
    reasons: [
      reasonOf(measures.changedLines === 0 ? 'no-change' : 'no-change-stack'),
    ],
  };
};

const checkedBy = (
  checked: boolean,
  checks: ChangeChecks | null,
  measures: EntryMeasures | null,
): Part => {
  if (!checks || checks.pending) {
    return PENDING;
  }

  switch (checks.state) {
    case 'absent':
      return unstacked(checked, measures);
    case 'failed':
      return {
        kind: 'failed',
        reasons:
          checks.failedAt.length > 0
            ? checks.failedAt.map((each) => reasonOf('check-failed', each))
            : [reasonOf('check-failed')],
      };
    case 'unchecked':
      return {
        kind: 'unscored',
        reasons: [
          checks.why === UNDRAFTED
            ? reasonOf('change-undrafted')
            : reasonOf('check-skipped', checks.why),
        ],
      };
    case 'passed':
      return { kind: 'passed', reasons: [] };
    case 'none':
      return checked
        ? {
            kind: 'unscored',
            reasons: [reasonOf('check-skipped', NO_CHECK_ASKED)],
          }
        : ABSENT;
    default:
      return ABSENT;
  }
};

const judged = (judges: boolean, judging: EntryJudging | null): Part => {
  if (!judges) {
    return ABSENT;
  }
  if (!judging || judging.pending) {
    return PENDING;
  }
  if (judging.unjudged) {
    return {
      kind: 'unscored',
      reasons: [reasonOf('unjudged', judging.unjudged)],
    };
  }

  const verdict = judging.verdict;

  if (!verdict) {
    return PENDING;
  }

  const code = verdict.passes ? 'judged' : 'judge-failed';
  const reasons = verdict.reasons.map((each) =>
    reasonOf(code, each.text, { steps: each.steps, hunks: each.hunks }),
  );

  return {
    kind: verdict.passes ? 'passed' : 'failed',
    reasons: reasons.length > 0 ? reasons : [reasonOf(code)],
  };
};

export const resultOf = (facts: EntryFacts, scoring: Scoring): EntryResult => {
  if (facts.refusal !== null) {
    return ended(null, reasonOf('unreplayable', facts.refusal));
  }
  if (facts.notRun) {
    return ended(null, reasonOf('not-run'));
  }
  if (!facts.end) {
    return { succeeded: null, reasons: [], concluded: false };
  }

  switch (facts.end.ending) {
    case 'failed':
      return ended(
        blamesTheCandidate(facts.end) ? false : null,
        reasonOf('run-failed', facts.end.failure),
      );
    case 'stopped':
      return ended(null, reasonOf('run-stopped'));
    case 'asked':
      return ended(false, reasonOf('asked-a-person'));
    default:
      break;
  }

  const parts = [
    checkedBy(scoring.checks, facts.checks, facts.measures),
    judged(scoring.judges, facts.judging),
  ];
  const reasons = parts.flatMap((each) =>
    'reasons' in each ? each.reasons : [],
  );
  const any = (kind: Part['kind']) => parts.some((each) => each.kind === kind);

  if (any('pending')) {
    return { succeeded: null, reasons, concluded: false };
  }
  if (any('failed')) {
    return ended(false, ...reasons);
  }
  if (any('unscored')) {
    return ended(null, ...reasons);
  }
  if (parts.every((each) => each.kind === 'absent')) {
    return ended(null, reasonOf('nothing-judges'));
  }

  return ended(true, ...reasons);
};
