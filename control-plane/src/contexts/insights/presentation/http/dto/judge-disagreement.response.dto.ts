import type {
  ClaimAnswerDto,
  DisagreementCitationDto,
  DisagreementClaimDto,
  DisagreementReasonDto,
  JudgeDisagreementDto,
  NotMetAnswerDto,
} from '@insights/application/dto/judge-disagreement.dto';
import { CITATION_KINDS } from '@insights/domain/value-objects/citation.vo';
import { CLAIM_ANSWERS } from '@insights/domain/value-objects/claim-answer.vo';
import { DISAGREEMENT_DIRECTIONS } from '@insights/domain/value-objects/disagreement-direction';
import { DISAGREEMENT_STATES } from '@insights/domain/value-objects/disagreement-state';
import { LABEL_SOURCES } from '@insights/domain/value-objects/label-source';
import { WITHDRAWAL_REASONS } from '@insights/domain/value-objects/withdrawal-reason';
import { ApiProperty } from '@nestjs/swagger';

export class DisagreementCitationResponseDto {
  @ApiProperty({ enum: CITATION_KINDS })
  readonly kind: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 12,
    description: 'The journal place of the cited step',
  })
  readonly step: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'api/src/uploads.ts#2',
    description: 'The id of the cited hunk',
  })
  readonly hunk: string | null;

  constructor(citation: DisagreementCitationDto) {
    this.kind = citation.kind;
    this.step = citation.step;
    this.hunk = citation.hunk;
  }
}

export class DisagreementReasonResponseDto {
  @ApiProperty({ example: 'The upload has no retry.' })
  readonly text: string;

  @ApiProperty({ type: DisagreementCitationResponseDto, isArray: true })
  readonly citations: readonly DisagreementCitationResponseDto[];

  constructor(reason: DisagreementReasonDto) {
    this.text = reason.text;
    this.citations = reason.citations.map(
      (each) => new DisagreementCitationResponseDto(each),
    );
  }
}

export class DisagreementClaimResponseDto {
  @ApiProperty({ example: 0, description: 'The place of the claim, from 0' })
  readonly index: number;

  @ApiProperty({ example: 'The upload retries on a network error.' })
  readonly text: string;

  @ApiProperty({ description: 'Whether the judge found the claim met' })
  readonly judgeMet: boolean;

  @ApiProperty({ type: DisagreementReasonResponseDto, isArray: true })
  readonly reasons: readonly DisagreementReasonResponseDto[];

  constructor(claim: DisagreementClaimDto) {
    this.index = claim.index;
    this.text = claim.text;
    this.judgeMet = claim.judgeMet;
    this.reasons = claim.reasons.map(
      (each) => new DisagreementReasonResponseDto(each),
    );
  }
}

export class ClaimAnswerResponseDto {
  @ApiProperty({ example: 0, description: 'The place of the claim, from 0' })
  readonly claim: number;

  @ApiProperty({
    enum: CLAIM_ANSWERS,
    description:
      'judge-right: the judge read the claim correctly. claim-wrong: the claim does not fit this run',
  })
  readonly answer: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Why the person answered this claim so',
  })
  readonly note: string | null;

  @ApiProperty()
  readonly answeredBy: string;

  @ApiProperty({ example: '2026-11-15T10:00:00.000Z' })
  readonly answeredAt: string;

  constructor(answer: ClaimAnswerDto) {
    this.claim = answer.claim;
    this.answer = answer.answer;
    this.note = answer.note;
    this.answeredBy = answer.answeredBy;
    this.answeredAt = answer.answeredAt;
  }
}

export class NotMetAnswerResponseDto {
  @ApiProperty({
    type: Number,
    nullable: true,
    example: 1,
    description:
      'The claim that should have failed, or null where no claim covers what was wrong',
  })
  readonly claim: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'What was wrong; always given where no claim covers it',
  })
  readonly note: string | null;

  @ApiProperty()
  readonly answeredBy: string;

  @ApiProperty({ example: '2026-11-15T10:00:00.000Z' })
  readonly answeredAt: string;

  constructor(answer: NotMetAnswerDto) {
    this.claim = answer.claim;
    this.note = answer.note;
    this.answeredBy = answer.answeredBy;
    this.answeredAt = answer.answeredAt;
  }
}

export class JudgeDisagreementResponseDto {
  @ApiProperty()
  readonly id: string;

  @ApiProperty()
  readonly runId: string;

  @ApiProperty()
  readonly taskId: string;

  @ApiProperty()
  readonly lineId: string;

  @ApiProperty()
  readonly stationId: string;

  @ApiProperty()
  readonly rubricVersion: string;

  @ApiProperty({
    enum: DISAGREEMENT_DIRECTIONS,
    description:
      'judge-failed: the judge failed a run that people passed. judge-passed: the judge passed a run that people failed',
  })
  readonly direction: string;

  @ApiProperty({
    enum: DISAGREEMENT_STATES,
    description:
      'open: the question waits for an answer to a claim in dispute, or, with none in dispute, for what was not met. answered: every claim in dispute has an answer, or, with none in dispute, what was not met. withdrawn: Spotlight withdrew the question, also after an answer',
  })
  readonly state: string;

  @ApiProperty({
    enum: LABEL_SOURCES,
    description:
      'What gave people’s verdict on the run when the disagreement opened, which disagrees with the judge’s',
  })
  readonly labelFrom: string;

  @ApiProperty({ example: '2026-11-14T10:00:00.000Z' })
  readonly openedAt: string;

  @ApiProperty({ type: DisagreementClaimResponseDto, isArray: true })
  readonly claims: readonly DisagreementClaimResponseDto[];

  @ApiProperty({
    type: Number,
    isArray: true,
    description:
      'The places of the claims in dispute, each answered on its own, fixed when the question opened: where the judge failed the run, the claims it failed; else none, and the one answer says what was not met',
  })
  readonly disputedClaims: readonly number[];

  @ApiProperty({
    type: ClaimAnswerResponseDto,
    isArray: true,
    description:
      'One answer for each claim in dispute answered so far, in claim order',
  })
  readonly answers: readonly ClaimAnswerResponseDto[];

  @ApiProperty({
    type: NotMetAnswerResponseDto,
    nullable: true,
    description:
      'Where no claim is in dispute: the answer, naming the claim that should have failed or saying what was wrong',
  })
  readonly notMet: NotMetAnswerResponseDto | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The one person who can answer: the person whose action gave people’s verdict when the disagreement opened. Null when a merged pull request opened it: then anyone who can read it can answer',
  })
  readonly askedOf: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'When Spotlight withdrew the question',
  })
  readonly withdrawnAt: string | null;

  @ApiProperty({
    enum: [...WITHDRAWAL_REASONS, null],
    nullable: true,
    description:
      'Why Spotlight withdrew the question: verdicts-agree, the judge and people agree on the run now; claims-changed, the judge’s claims changed after the run, or the judge was removed; label-gone, the run no longer has people’s verdict. Null while not withdrawn',
  })
  readonly withdrawnBecause: string | null;

  constructor(disagreement: JudgeDisagreementDto) {
    this.id = disagreement.id;
    this.runId = disagreement.runId;
    this.taskId = disagreement.taskId;
    this.lineId = disagreement.lineId;
    this.stationId = disagreement.stationId;
    this.rubricVersion = disagreement.rubricVersion;
    this.direction = disagreement.direction;
    this.state = disagreement.state;
    this.labelFrom = disagreement.labelFrom;
    this.openedAt = disagreement.openedAt;
    this.claims = disagreement.claims.map(
      (each) => new DisagreementClaimResponseDto(each),
    );
    this.disputedClaims = [...disagreement.disputedClaims];
    this.answers = disagreement.answers.map(
      (each) => new ClaimAnswerResponseDto(each),
    );
    this.notMet = disagreement.notMet
      ? new NotMetAnswerResponseDto(disagreement.notMet)
      : null;
    this.askedOf = disagreement.askedOf;
    this.withdrawnAt = disagreement.withdrawnAt;
    this.withdrawnBecause = disagreement.withdrawnBecause;
  }
}

export class AnswerDisagreementClaimRequestDto {
  @ApiProperty({ enum: CLAIM_ANSWERS })
  readonly answer!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Why, optional; at most 2,000 characters',
  })
  readonly note!: string | null;
}

export class AnswerJudgeDisagreementRequestDto {
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'The place of the claim that should have failed, from 0, or null where no claim covers what was wrong; always given',
  })
  readonly shouldHaveFailed!: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'What was wrong: required where no claim is named, optional otherwise; at most 2,000 characters',
  })
  readonly note!: string | null;
}
