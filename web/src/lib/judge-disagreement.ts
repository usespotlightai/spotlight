import type {
  AnswerDisagreementClaimRequestDto,
  AnswerJudgeDisagreementRequestDto,
  ClaimAnswerResponseDto,
  DisagreementClaimResponseDto,
  DisagreementCitationResponseDto,
  JudgeDisagreementResponseDto,
} from '@/lib/api';
import type { ApprovalStatus } from '@/lib/approval-status';
import type { Citation, JudgeReason, RunScores } from '@/lib/judge';
import type { Person } from '@/lib/person';

export type JudgeDisagreement = JudgeDisagreementResponseDto;

export type DisagreementClaim = DisagreementClaimResponseDto;

export type ClaimAnswer = AnswerDisagreementClaimRequestDto['answer'];

export type ClaimAnswerBody = AnswerDisagreementClaimRequestDto;

export type GivenClaimAnswer = ClaimAnswerResponseDto;

export type NotMetAnswer = AnswerJudgeDisagreementRequestDto;

export type DisagreementCardState = JudgeDisagreement['state'];

export const DISAGREEMENT_STATUSES: Record<
  JudgeDisagreement['state'],
  ApprovalStatus
> = {
  open: 'pending',
  answered: 'approved',
  withdrawn: 'dismissed',
};

const WAITING_FOR_YOUR_ANSWER = 'Waiting for your answer';

const WITHDRAWN = 'Withdrawn';

const formatAnsweredBy = (who: string): string => `Answered by ${who}`;

const titleOf = (
  state: DisagreementCardState,
  answerer: string | null,
): string => {
  switch (state) {
    case 'open':
      return WAITING_FOR_YOUR_ANSWER;
    case 'answered':
      return answerer ? formatAnsweredBy(answerer) : 'Answered';
    case 'withdrawn':
      return WITHDRAWN;
  }
};

export const disagreementTitleOf = (
  disagreement: JudgeDisagreement,
  answerer: string | null,
): string => titleOf(disagreement.state, answerer);

export const answerOfClaim = (
  disagreement: JudgeDisagreement,
  claim: number,
): GivenClaimAnswer | null =>
  disagreement.answers.find((each) => each.claim === claim) ?? null;

export const cardStateOf = (
  disagreement: JudgeDisagreement,
  claim: number,
): DisagreementCardState => {
  if (disagreement.state === 'withdrawn') {
    return 'withdrawn';
  }

  return answerOfClaim(disagreement, claim) ? 'answered' : 'open';
};

export const claimCardTitleOf = (
  disagreement: JudgeDisagreement,
  claim: number,
  answerer: string | null,
): string => titleOf(cardStateOf(disagreement, claim), answerer);

export const claimCardLabel = (claim: number): string =>
  `Disagreement on claim ${claim + 1}`;

export const claimDecisionId = (claim: number): string =>
  `judge-disagreement:claim-${claim}`;

const factOf = (disagreement: JudgeDisagreement): string => {
  switch (disagreement.labelFrom) {
    case 'accepted':
      return 'You accepted this run. The judge failed it.';
    case 'sent-back':
      return 'You sent this run back. The judge passed it.';
    case 'held-as-wrong':
      return 'You held this run as wrong. The judge passed it.';
    case 'merged':
      return 'The pull request was merged. The judge failed the run.';
  }
};

const DISAGREEMENT_PURPOSE = 'Your answer helps Spotlight rewrite the claims.';

const WITHDRAWN_BECAUSE: Record<
  NonNullable<JudgeDisagreement['withdrawnBecause']>,
  string
> = {
  'verdicts-agree': 'The judge and people agree on this run now.',
  'claims-changed': 'The station’s judge changed after this run.',
  'label-gone': 'People’s verdict on this run is gone.',
};

export const sentenceOf = (disagreement: JudgeDisagreement): string => {
  const fact = factOf(disagreement);

  if (disagreement.state === 'open') {
    return `${fact} ${DISAGREEMENT_PURPOSE}`;
  }

  return disagreement.state === 'withdrawn' && disagreement.withdrawnBecause
    ? `${fact} ${WITHDRAWN_BECAUSE[disagreement.withdrawnBecause]}`
    : fact;
};

export const DISPUTED_CLAIMS_LABEL = 'Claims in dispute';

export const DISAGREEMENT_ANSWERS: readonly {
  readonly answer: ClaimAnswer;
  readonly label: string;
}[] = [
  { answer: 'judge-right', label: 'The judge is right' },
  { answer: 'claim-wrong', label: 'The claim does not fit this run' },
];

export const claimAnswerLabel = (answer: ClaimAnswer): string =>
  DISAGREEMENT_ANSWERS.find((each) => each.answer === answer)?.label ?? '';

export const WHY = 'Why';

export const WHAT_WAS_WRONG = 'What was wrong';

export const NOTE_PLACEHOLDER = 'Tell Spotlight why (optional)';

export const WHAT_WAS_WRONG_PLACEHOLDER =
  'Tell Spotlight what the run did wrong';

export const MAX_NOTE = 2_000;

const PICK_AN_ANSWER_TO_SEND = 'Pick an answer to send';

const PICK_A_CLAIM_TO_SEND = 'Pick a claim to send';

const SAY_WHAT_WAS_WRONG_TO_SEND = 'Say what the run did wrong to send';

export const NO_CLAIM_COVERS_IT = 'No claim covers it';

export const CLAIM_LABEL = 'Claim';

export const CLAIMS_LABEL = 'Claims';

export const CLAIM_NOT_MET = 'Claim not met';

export const ANSWER_LABEL = 'Answer';

export const SEND_ANSWER = 'Send answer';

export const SENDING_ANSWER = 'Sending…';

export const OPEN_THE_TRACE = 'Open the trace';

export const RESOLVED_PREVIEW = 'Disagreement resolved.';

export const OPEN_PREVIEW =
  'The judge and people disagree on a run. Spotlight asks why.';

export const answererOf = (
  answeredBy: string | null,
  me: Person | null,
  members: readonly Person[] | undefined,
): string | null => {
  if (!answeredBy) {
    return null;
  }

  return answeredBy === me?.id
    ? 'you'
    : (members?.find((each) => each.id === answeredBy)?.name ?? null);
};

const claimsAt = (
  disagreement: JudgeDisagreement,
  indexes: readonly number[],
): DisagreementClaim[] =>
  indexes.flatMap(
    (index) => disagreement.claims.find((each) => each.index === index) ?? [],
  );

export const disputedClaimsOf = (
  disagreement: JudgeDisagreement,
): DisagreementClaim[] => claimsAt(disagreement, disagreement.disputedClaims);

const sameCitation = (
  cited: DisagreementCitationResponseDto,
  full: Citation,
): boolean =>
  cited.kind === full.kind &&
  (cited.kind === 'step'
    ? full.step?.index === cited.step
    : full.hunk?.id === cited.hunk);

export const reasonsOf = (
  claim: DisagreementClaim,
  scores: RunScores | undefined,
): JudgeReason[] => {
  const known = scores?.judge?.reasons.flatMap((each) => each.citations) ?? [];

  return claim.reasons.map((reason) => ({
    claim: claim.index,
    text: reason.text,
    citations: reason.citations.flatMap(
      (cited) => known.find((full) => sameCitation(cited, full)) ?? [],
    ),
  }));
};

export const NO_CLAIM = 'none';

export type NotMetPick = number | typeof NO_CLAIM | null;

export type NotMetDraft = {
  readonly note: string;
  readonly notMet: NotMetPick;
};

export const EMPTY_NOT_MET_DRAFT: NotMetDraft = {
  note: '',
  notMet: null,
};

export type ClaimDraft = {
  readonly answer: ClaimAnswer | null;
  readonly note: string;
};

export const EMPTY_CLAIM_DRAFT: ClaimDraft = {
  answer: null,
  note: '',
};

export const noteRequired = (draft: NotMetDraft): boolean =>
  draft.notMet === NO_CLAIM;

export const notMetAnswerOf = (draft: NotMetDraft): NotMetAnswer | null => {
  const note = draft.note.trim() || null;

  if (draft.notMet === null || (noteRequired(draft) && !note)) {
    return null;
  }

  return {
    note,
    shouldHaveFailed: draft.notMet === NO_CLAIM ? null : draft.notMet,
  };
};

export const notMetBlockedReason = (draft: NotMetDraft): string | null => {
  if (draft.notMet === null) {
    return PICK_A_CLAIM_TO_SEND;
  }

  return noteRequired(draft) && !draft.note.trim()
    ? SAY_WHAT_WAS_WRONG_TO_SEND
    : null;
};

export const claimAnswerOf = (draft: ClaimDraft): ClaimAnswerBody | null =>
  draft.answer
    ? { answer: draft.answer, note: draft.note.trim() || null }
    : null;

export const claimBlockedReason = (draft: ClaimDraft): string | null =>
  draft.answer ? null : PICK_AN_ANSWER_TO_SEND;
