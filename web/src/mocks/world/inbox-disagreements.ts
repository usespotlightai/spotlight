import type {
  JudgeDisagreementResponseDto,
  JudgeScoreResponseDto,
} from '@/lib/api';
import type { RunScores } from '@/lib/judge';
import {
  acceptedRun,
  claimsChangedRun,
  labelGoneRun,
  mergedRun,
  type Opening,
  openingOfRun,
  sentBackRun,
  verdictsAgreeRun,
  type Withdrawal,
} from '@/mocks/world/disagreement-runs';
import {
  ACCEPTED_DISAGREEMENT_ID,
  CLAIMS_CHANGED_DISAGREEMENT_ID,
  LABEL_GONE_DISAGREEMENT_ID,
  MERGED_DISAGREEMENT_ID,
  SEARCH_DISAGREEMENT_ID,
  SENT_BACK_DISAGREEMENT_ID,
  VERDICTS_AGREE_DISAGREEMENT_ID,
} from '@/mocks/world/inbox';
import { lineOfStation, minutesAfter } from '@/mocks/world/inbox-places';
import { judgedScoresOf, seedRunScores } from '@/mocks/world/inbox-scores';
import { SAM, TOM } from '@/mocks/world/people';
import { labelPasses } from '@/mocks/world/run-labels';

const claimsOf = (
  judge: JudgeScoreResponseDto,
): JudgeDisagreementResponseDto['claims'] =>
  judge.claims.map((text, index) => ({
    index,
    text,
    judgeMet: judge.claimResults[index] ?? false,
    reasons: judge.reasons
      .filter((reason) => reason.claim === index)
      .map((reason) => ({
        text: reason.text,
        citations: reason.citations.map((citation) => ({
          kind: citation.kind,
          step: citation.step?.index ?? null,
          hunk: citation.hunk?.id ?? null,
        })),
      })),
  }));

const disputedOf = (judge: JudgeScoreResponseDto): number[] =>
  judge.passes
    ? []
    : judge.claimResults.flatMap((met, at) => (met ? [] : [at]));

const disagreementFrom = (
  id: string,
  scores: RunScores | null,
  opening: Opening | null,
  withdrawal: Pick<
    JudgeDisagreementResponseDto,
    'withdrawnAt' | 'withdrawnBecause'
  > | null = null,
): JudgeDisagreementResponseDto | null => {
  const judge = scores?.judge;

  if (
    !scores ||
    !judge ||
    !opening ||
    judge.passes === labelPasses(opening.labelFrom)
  ) {
    return null;
  }

  return {
    id,
    runId: scores.runId,
    taskId: scores.taskId,
    lineId: lineOfStation(scores.stationId),
    stationId: scores.stationId,
    rubricVersion: judge.rubricVersion,
    direction: judge.passes ? 'judge-passed' : 'judge-failed',
    labelFrom: opening.labelFrom,
    openedAt: opening.openedAt,
    claims: claimsOf(judge),
    disputedClaims: disputedOf(judge),
    state: withdrawal ? 'withdrawn' : 'open',
    askedOf: opening.askedOf,
    answers: [],
    notMet: null,
    withdrawnAt: withdrawal?.withdrawnAt ?? null,
    withdrawnBecause: withdrawal?.withdrawnBecause ?? null,
  };
};

const seededDisagreement = (
  id: string,
  runId: string,
): JudgeDisagreementResponseDto | null =>
  disagreementFrom(
    id,
    seedRunScores([runId])[runId] ?? null,
    openingOfRun(runId),
  );

const pastDisagreement = (
  id: string,
  opening: Opening | null,
): JudgeDisagreementResponseDto | null =>
  disagreementFrom(id, opening && judgedScoresOf(opening.run), opening);

const withdrawnDisagreement = (
  id: string,
  withdrawal: Withdrawal | null,
  withdrawnBecause: NonNullable<
    JudgeDisagreementResponseDto['withdrawnBecause']
  >,
): JudgeDisagreementResponseDto | null =>
  disagreementFrom(
    id,
    withdrawal && judgedScoresOf(withdrawal.run),
    withdrawal,
    withdrawal && { withdrawnAt: withdrawal.withdrawnAt, withdrawnBecause },
  );

export const seedJudgeDisagreements = (): Record<
  string,
  JudgeDisagreementResponseDto
> =>
  Object.fromEntries(
    [
      seededDisagreement(SEARCH_DISAGREEMENT_ID, 'run_search_2'),
      pastDisagreement(SENT_BACK_DISAGREEMENT_ID, sentBackRun()),
      pastDisagreement(ACCEPTED_DISAGREEMENT_ID, acceptedRun()),
      pastDisagreement(MERGED_DISAGREEMENT_ID, mergedRun()),
      withdrawnDisagreement(
        VERDICTS_AGREE_DISAGREEMENT_ID,
        verdictsAgreeRun(),
        'verdicts-agree',
      ),
      withdrawnDisagreement(
        CLAIMS_CHANGED_DISAGREEMENT_ID,
        claimsChangedRun(),
        'claims-changed',
      ),
      withdrawnDisagreement(
        LABEL_GONE_DISAGREEMENT_ID,
        labelGoneRun(),
        'label-gone',
      ),
    ].flatMap((disagreement) =>
      disagreement ? [[disagreement.id, disagreement]] : [],
    ),
  );

const SEEDED_ANSWERS = [
  {
    answer: 'judge-right',
    note: 'The failing check was the lint step. It must pass.',
  },
  {
    answer: 'claim-wrong',
    note: 'The spec allows a known flaky check to fail.',
  },
] as const;

export type ClaimsAnswered = 'none' | 'first' | 'all';

export const answerDisputedClaims = (
  disagreement: JudgeDisagreementResponseDto,
  answered: ClaimsAnswered,
): void => {
  if (disagreement.state !== 'open') {
    return;
  }

  const claims =
    answered === 'all'
      ? disagreement.disputedClaims
      : disagreement.disputedClaims.slice(0, answered === 'first' ? 1 : 0);

  disagreement.answers = claims.map((claim, at) => {
    const seeded = SEEDED_ANSWERS.at(at % SEEDED_ANSWERS.length);
    return {
      claim,
      answer: seeded?.answer ?? 'judge-right',
      note: answered === 'all' && at === 0 ? null : (seeded?.note ?? null),
      answeredBy: disagreement.askedOf ?? (at === 0 ? SAM.id : TOM.id),
      answeredAt: minutesAfter(disagreement.openedAt, 30 + at * 20),
    };
  });
  if (
    claims.length > 0 &&
    claims.length === disagreement.disputedClaims.length
  ) {
    disagreement.state = 'answered';
  }
};
