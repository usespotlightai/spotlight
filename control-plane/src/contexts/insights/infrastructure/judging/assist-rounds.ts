import type { ChangeJudgmentRound } from '@insights/application/ports/change-judgments.port';
import type { JudgeRound } from '@insights/application/ports/judge.port';
import type {
  PairJudgmentOrderKind,
  PairJudgmentRound,
} from '@insights/application/ports/pair-judgments.port';
import type { SettledSession } from '@insights/application/ports/session-outcomes';
import { ClaimsRevisionId } from '@insights/domain/value-objects/claims-revision-id.vo';
import { ClaimsRevisionRound } from '@insights/domain/value-objects/claims-revision-round.vo';
import { JudgingRound } from '@insights/domain/value-objects/judging-round.vo';
import { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const JUDGE_PURPOSE = 'insights.judge';

export const PAIR_JUDGE_PURPOSE = 'insights.pair-judge';

export const CLAIMS_PURPOSE = 'insights.claims';

/** What a round decides of the session it orders: its purpose, its key, and the run it is based on. */
export interface RoundSession {
  readonly purpose: string;
  readonly key: string;
  readonly basedOnRun: string;
}

const PASSES: readonly PairJudgmentOrderKind[] = ['run-first', 'other-first'];

const keyOf = (...parts: readonly (string | number)[]): string =>
  parts.map((each) => encodeURIComponent(String(each))).join(':');

const partsOf = (
  key: string,
  prefix: string,
  count: number,
): readonly (string | undefined)[] | null => {
  const parts = key.split(':').map((each) => decodeURIComponent(each));

  return parts.length === count + 1 &&
    parts[0] === prefix &&
    parts.every((each) => each.trim().length > 0)
    ? parts.slice(1)
    : null;
};

const attemptOf = (text: string | undefined): number | null => {
  const attempt = Number(text);

  return /^\d+$/.test(text ?? '') && attempt >= 1 ? attempt : null;
};

/** A key insights did not write, or wrote for no round it still knows, names no round. */
const readable = <T>(read: () => T | null): T | null => {
  try {
    return read();
  } catch {
    return null;
  }
};

export const judgeSessionOf = (round: JudgeRound): RoundSession => {
  switch (round.of) {
    case 'judging':
      return {
        purpose: JUDGE_PURPOSE,
        key: keyOf(
          'judging',
          round.round.runId.value,
          round.round.rubricVersion,
          round.round.attempt,
        ),
        basedOnRun: round.round.runId.value,
      };
    case 'candidate':
      return {
        purpose: JUDGE_PURPOSE,
        key: keyOf(
          'claims-revision',
          round.round.revisionId.value,
          round.round.attempt,
          round.candidate,
          round.runId.value,
        ),
        basedOnRun: round.runId.value,
      };
    case 'change':
      return {
        purpose: JUDGE_PURPOSE,
        key: keyOf(
          'change-judging',
          round.round.runId.value,
          round.round.judging,
          round.round.attempt,
        ),
        basedOnRun: round.round.runId.value,
      };
  }
};

const judgingRoundOf = (key: string): JudgeRound | null => {
  const [run, version, attempt] = partsOf(key, 'judging', 3) ?? [];
  const rubricVersion = RubricVersion.readable(version ?? '');
  const tried = attemptOf(attempt);

  return nonEmpty(run) && rubricVersion && tried !== null && tried !== 0
    ? {
        of: 'judging',
        round: JudgingRound.of({
          runId: RunId.of(run),
          rubricVersion,
          attempt: tried,
        }),
      }
    : null;
};

const candidateRoundOf = (key: string): JudgeRound | null => {
  const [revision, attempt, candidate, run] =
    partsOf(key, 'claims-revision', 4) ?? [];
  const tried = attemptOf(attempt);
  const at = Number(candidate);

  return nonEmpty(revision) &&
    tried !== null &&
    tried !== 0 &&
    nonEmpty(run) &&
    /^\d+$/.test(candidate ?? '')
    ? {
        of: 'candidate',
        round: ClaimsRevisionRound.of({
          revisionId: ClaimsRevisionId.of(revision),
          attempt: tried,
        }),
        candidate: at,
        runId: RunId.of(run),
      }
    : null;
};

const changeRoundOf = (key: string): JudgeRound | null => {
  const [run, judging, attempt] = partsOf(key, 'change-judging', 3) ?? [];
  const judged = attemptOf(judging);
  const tried = attemptOf(attempt);
  const round: ChangeJudgmentRound | null =
    nonEmpty(run) &&
    judged !== null &&
    judged !== 0 &&
    tried !== null &&
    tried !== 0
      ? { runId: RunId.of(run), judging: judged, attempt: tried }
      : null;

  return round ? { of: 'change', round } : null;
};

export const judgeRoundOf = (session: SettledSession): JudgeRound | null =>
  session.purpose === JUDGE_PURPOSE
    ? readable(
        () =>
          judgingRoundOf(session.key) ??
          candidateRoundOf(session.key) ??
          changeRoundOf(session.key),
      )
    : null;

export const pairSessionOf = (
  round: PairJudgmentRound,
  pass: PairJudgmentOrderKind,
): RoundSession => ({
  purpose: PAIR_JUDGE_PURPOSE,
  key: keyOf(
    'pair-judging',
    round.runId.value,
    round.otherRunId.value,
    round.attempt,
    pass,
  ),
  basedOnRun: round.runId.value,
});

export const pairRoundOf = (
  session: SettledSession,
): PairJudgmentRound | null =>
  session.purpose === PAIR_JUDGE_PURPOSE
    ? readable(() => {
        const [run, other, attempt, pass] =
          partsOf(session.key, 'pair-judging', 4) ?? [];
        const tried = attemptOf(attempt);

        return nonEmpty(run) &&
          nonEmpty(other) &&
          tried !== null &&
          tried !== 0 &&
          PASSES.some((each) => each === pass)
          ? {
              runId: RunId.of(run),
              otherRunId: RunId.of(other),
              attempt: tried,
            }
          : null;
      })
    : null;

export const draftingSessionOf = (
  round: ClaimsRevisionRound,
  draftedFrom: RunId,
): RoundSession => ({
  purpose: CLAIMS_PURPOSE,
  key: keyOf('claims-revision', round.revisionId.value, round.attempt),
  basedOnRun: draftedFrom.value,
});

export const draftingRoundOf = (
  session: SettledSession,
): ClaimsRevisionRound | null =>
  session.purpose === CLAIMS_PURPOSE
    ? readable(() => {
        const [revision, attempt] =
          partsOf(session.key, 'claims-revision', 2) ?? [];
        const tried = attemptOf(attempt);

        return nonEmpty(revision) && tried !== null && tried !== 0
          ? ClaimsRevisionRound.of({
              revisionId: ClaimsRevisionId.of(revision),
              attempt: tried,
            })
          : null;
      })
    : null;
