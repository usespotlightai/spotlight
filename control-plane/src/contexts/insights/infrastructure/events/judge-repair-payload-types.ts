import { ClaimsRevisionEnded } from '@insights/domain/events/claims-revision-ended.event';
import { ClaimsRevisionPicked } from '@insights/domain/events/claims-revision-picked.event';
import { ClaimsRevisionStarted } from '@insights/domain/events/claims-revision-started.event';
import { ClaimsSourceErased } from '@insights/domain/events/claims-source-erased.event';
import { ClaimsSourceRecorded } from '@insights/domain/events/claims-source-recorded.event';
import { ClaimsSourceResolved } from '@insights/domain/events/claims-source-resolved.event';
import { JudgeDisagreementAnswered } from '@insights/domain/events/judge-disagreement-answered.event';
import { JudgeDisagreementClaimAnswered } from '@insights/domain/events/judge-disagreement-claim-answered.event';
import { JudgeDisagreementOpened } from '@insights/domain/events/judge-disagreement-opened.event';
import { JudgeDisagreementWithdrawn } from '@insights/domain/events/judge-disagreement-withdrawn.event';
import { ClaimAnswer } from '@insights/domain/value-objects/claim-answer.vo';
import { ClaimsRevisionId } from '@insights/domain/value-objects/claims-revision-id.vo';
import { JudgeDisagreementId } from '@insights/domain/value-objects/judge-disagreement-id.vo';
import { NotMetAnswer } from '@insights/domain/value-objects/not-met-answer.vo';
import { RevisionOutcome } from '@insights/domain/value-objects/revision-outcome.vo';

export const JUDGE_REPAIR_PAYLOAD_TYPES = [
  JudgeDisagreementId,
  ClaimsRevisionId,
  JudgeDisagreementOpened,
  JudgeDisagreementClaimAnswered,
  JudgeDisagreementAnswered,
  JudgeDisagreementWithdrawn,
  ClaimsRevisionStarted,
  ClaimsRevisionPicked,
  ClaimsRevisionEnded,
  ClaimsSourceRecorded,
  ClaimsSourceResolved,
  ClaimsSourceErased,
  ClaimAnswer,
  NotMetAnswer,
  RevisionOutcome,
] as const;
