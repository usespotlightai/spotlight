import type { JudgeDisagreementResponseDto } from '@/lib/api';
import type { RunScores } from '@/lib/judge';
import {
  acceptedRun,
  askedOfOtherRun,
  claimsChangedRun,
  labelGoneRun,
  mergedRun,
  sentBackRun,
} from '@/mocks/world/disagreement-runs';
import {
  ACCEPTED_DISAGREEMENT_ID,
  ASKED_OF_OTHER_DISAGREEMENT_ID,
  CLAIMS_CHANGED_DISAGREEMENT_ID,
  FAILED_DISAGREEMENT_ID,
  LABEL_GONE_DISAGREEMENT_ID,
  MERGED_DISAGREEMENT_ID,
  PASSED_DISAGREEMENT_ID,
  SENT_BACK_DISAGREEMENT_ID,
  WITHDRAWN_DISAGREEMENT_ID,
} from '@/mocks/world/inbox';
import {
  lineOfStation,
  minutesAfter,
  runEnded,
} from '@/mocks/world/inbox-places';
import { pastScoresOf, seedRunScores } from '@/mocks/world/inbox-scores';
import type { HistoryRun } from '@/mocks/world/insights-history';
import { MAYA, SAM, TOM } from '@/mocks/world/people';

const claimsOf = (scores: RunScores): JudgeDisagreementResponseDto['claims'] =>
  scores.claims.map((text, index) => ({
    index,
    text: text ?? '',
    judgeMet: scores.judge?.claimResults[index] ?? false,
    reasons: (scores.judge?.reasons ?? [])
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

const disputedOf = (scores: RunScores): number[] =>
  scores.judge?.passes
    ? []
    : (scores.judge?.claimResults ?? []).flatMap((met, at) =>
        met ? [] : [at],
      );

const disagreementFrom = (
  id: string,
  scores: RunScores | undefined,
  openedAt: string,
  over: Partial<JudgeDisagreementResponseDto> = {},
): JudgeDisagreementResponseDto | null => {
  const judge = scores?.judge;

  if (!scores || !judge) {
    return null;
  }

  const labelFrom =
    over.labelFrom ??
    scores.label?.from ??
    (judge.passes ? 'sent-back' : 'accepted');

  return {
    id,
    runId: scores.runId,
    taskId: scores.taskId,
    lineId: lineOfStation(scores.stationId),
    stationId: scores.stationId,
    rubricVersion: judge.rubricVersion,
    direction: judge.passes ? 'judge-passed' : 'judge-failed',
    labelFrom,
    openedAt,
    claims: claimsOf(scores),
    disputedClaims: disputedOf(scores),
    state: 'open',
    askedOf: SAM.id,
    answers: [],
    notMet: null,
    withdrawnAt: null,
    withdrawnBecause: null,
    ...over,
  };
};

const seededDisagreement = (
  id: string,
  runId: string,
  over: Partial<JudgeDisagreementResponseDto> = {},
): JudgeDisagreementResponseDto | null =>
  disagreementFrom(
    id,
    seedRunScores([runId])[runId],
    minutesAfter(runEnded(runId), 95),
    over,
  );

const endOf = (run: HistoryRun): string =>
  run.endedAt ?? new Date(run.at).toISOString();

const pastDisagreement = (
  id: string,
  run: HistoryRun | null,
  over: Partial<JudgeDisagreementResponseDto>,
): JudgeDisagreementResponseDto | null =>
  run
    ? disagreementFrom(
        id,
        pastScoresOf(run),
        minutesAfter(endOf(run), 95),
        over,
      )
    : null;

const withdrawnAfter = (run: HistoryRun | null): string | null =>
  run ? minutesAfter(endOf(run), 600) : null;

export const seedJudgeDisagreements = (): Record<
  string,
  JudgeDisagreementResponseDto
> =>
  Object.fromEntries(
    [
      seededDisagreement(FAILED_DISAGREEMENT_ID, 'run_search_2'),
      seededDisagreement(PASSED_DISAGREEMENT_ID, 'run_postgres_2'),
      seededDisagreement(WITHDRAWN_DISAGREEMENT_ID, 'run_billing_1', {
        labelFrom: 'accepted',
        state: 'withdrawn',
        withdrawnAt: minutesAfter(runEnded('run_billing_1'), 180),
        withdrawnBecause: 'verdicts-agree',
      }),
      pastDisagreement(SENT_BACK_DISAGREEMENT_ID, sentBackRun(), {
        labelFrom: 'sent-back',
      }),
      pastDisagreement(ACCEPTED_DISAGREEMENT_ID, acceptedRun(), {
        labelFrom: 'accepted',
      }),
      pastDisagreement(MERGED_DISAGREEMENT_ID, mergedRun(), {
        labelFrom: 'merged',
        askedOf: null,
      }),
      pastDisagreement(ASKED_OF_OTHER_DISAGREEMENT_ID, askedOfOtherRun(), {
        labelFrom: 'accepted',
        askedOf: MAYA.id,
      }),
      pastDisagreement(CLAIMS_CHANGED_DISAGREEMENT_ID, claimsChangedRun(), {
        labelFrom: 'accepted',
        state: 'withdrawn',
        withdrawnAt: withdrawnAfter(claimsChangedRun()),
        withdrawnBecause: 'claims-changed',
      }),
      pastDisagreement(LABEL_GONE_DISAGREEMENT_ID, labelGoneRun(), {
        labelFrom: 'sent-back',
        state: 'withdrawn',
        withdrawnAt: withdrawnAfter(labelGoneRun()),
        withdrawnBecause: 'label-gone',
      }),
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
  const claims =
    answered === 'all'
      ? disagreement.disputedClaims
      : disagreement.disputedClaims.slice(0, answered === 'first' ? 1 : 0);

  disagreement.answers = claims.map((claim, at) => {
    const seeded = SEEDED_ANSWERS[at % SEEDED_ANSWERS.length];
    return {
      claim,
      answer: seeded?.answer ?? 'judge-right',
      note: answered === 'all' && at === 0 ? null : (seeded?.note ?? null),
      answeredBy: disagreement.askedOf ?? (at === 0 ? SAM.id : TOM.id),
      answeredAt: minutesAfter(disagreement.openedAt, 30 + at * 20),
    };
  });
  if (
    answered === 'all' &&
    claims.length > 0 &&
    disagreement.state === 'open'
  ) {
    disagreement.state = 'answered';
  }
};
