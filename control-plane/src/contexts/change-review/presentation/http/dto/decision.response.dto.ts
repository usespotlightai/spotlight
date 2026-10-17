import {
  DECISION_KIND_NAMES,
  DECISION_STATUS_NAMES,
  type DecisionDto,
  type DecisionMergeDto,
  type DisputeDto,
  type MergedDecisionsDto,
  type TaskDecisionsDto,
} from '@change-review/application/dto/decision.dto';
import { ApiProperty } from '@nestjs/swagger';

export class DisputeResponseDto {
  @ApiProperty()
  readonly id: string;

  @ApiProperty({ description: 'The file of the decision it is about' })
  readonly path: string;

  @ApiProperty({ description: 'The person who disputed it' })
  readonly by: string;

  @ApiProperty({ nullable: true, type: String })
  readonly byName: string | null;

  @ApiProperty({ example: 'The client already retries twice.' })
  readonly reason: string;

  @ApiProperty({ type: String, format: 'date-time' })
  readonly at: string;

  constructor(dispute: DisputeDto) {
    this.id = dispute.id;
    this.path = dispute.path;
    this.by = dispute.by;
    this.byName = dispute.byName;
    this.reason = dispute.reason;
    this.at = dispute.at.toISOString();
  }
}

export class DecisionResponseDto {
  @ApiProperty({ description: 'Disputes name the decision by this' })
  readonly id: string;

  @ApiProperty({ enum: DECISION_KIND_NAMES })
  readonly kind: DecisionDto['kind'];

  @ApiProperty({ example: 'Retries uploads in the request, not from a queue' })
  readonly title: string;

  @ApiProperty({
    description: 'What led the agent to it, and what it costs',
  })
  readonly why: string;

  @ApiProperty({
    type: [String],
    description: 'The options the agent weighed and set aside',
  })
  readonly alternatives: string[];

  @ApiProperty({
    type: [String],
    example: ['api/src/uploads.ts'],
    description: 'The changed files it bears on, from the workspace root',
  })
  readonly paths: string[];

  @ApiProperty({
    type: [Number],
    description: 'Where the agent reasoned it, as steps of the run’s journal',
  })
  readonly steps: number[];

  @ApiProperty({
    type: [DisputeResponseDto],
    description: 'Who says it is wrong or out of date, and why',
  })
  readonly disputes: DisputeResponseDto[];

  constructor(decision: DecisionDto) {
    this.id = decision.id;
    this.kind = decision.kind;
    this.title = decision.title;
    this.why = decision.why;
    this.alternatives = [...decision.alternatives];
    this.paths = [...decision.paths];
    this.steps = [...decision.steps];
    this.disputes = decision.disputes.map(
      (each) => new DisputeResponseDto(each),
    );
  }
}

export class DecisionMergeResponseDto {
  @ApiProperty({ example: 'acme/api' })
  readonly repository: string;

  @ApiProperty({ description: 'The commit the merge made' })
  readonly commit: string;

  @ApiProperty({ type: String, format: 'date-time' })
  readonly at: string;

  constructor(merge: DecisionMergeDto) {
    this.repository = merge.repository;
    this.commit = merge.commit;
    this.at = merge.at.toISOString();
  }
}

export class TaskDecisionsResponseDto {
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The run the decisions were drafted from, if any was',
  })
  readonly runId: string | null;

  @ApiProperty({
    description: 'Whether a later run’s decisions are being drafted',
  })
  readonly drafting: boolean;

  @ApiProperty({ enum: DECISION_STATUS_NAMES })
  readonly status: TaskDecisionsDto['status'];

  @ApiProperty({
    nullable: true,
    type: DecisionMergeResponseDto,
    description:
      'The merge that contains the decisions, after the pull request merges',
  })
  readonly merge: DecisionMergeResponseDto | null;

  @ApiProperty({
    type: [DecisionResponseDto],
    description: 'Deviations and limitations first',
  })
  readonly decisions: DecisionResponseDto[];

  constructor(found: TaskDecisionsDto) {
    this.runId = found.runId;
    this.drafting = found.drafting;
    this.status = found.status;
    this.merge = found.merge && new DecisionMergeResponseDto(found.merge);
    this.decisions = found.decisions.map(
      (each) => new DecisionResponseDto(each),
    );
  }
}

export class DisputeDecisionRequestDto {
  @ApiProperty({
    example: 'The client already retries twice, so this retry is a third.',
    description: 'Why the decision is wrong or out of date',
  })
  readonly reason!: string;

  @ApiProperty({
    example: 'api/src/uploads/retry.ts',
    description: 'The file of the decision the dispute is about',
  })
  readonly path!: string;
}

export class MergedDecisionsResponseDto {
  @ApiProperty()
  readonly taskId: string;

  @ApiProperty({ nullable: true, type: String })
  readonly runId: string | null;

  @ApiProperty({ example: 'acme/api' })
  readonly repository: string;

  @ApiProperty({ description: 'The commit the merge made' })
  readonly commit: string;

  @ApiProperty({ type: String, format: 'date-time' })
  readonly mergedAt: string;

  @ApiProperty({
    type: [DecisionResponseDto],
    description:
      'Those bearing on the paths asked about; deviations and limitations first',
  })
  readonly decisions: DecisionResponseDto[];

  constructor(found: MergedDecisionsDto) {
    this.taskId = found.taskId;
    this.runId = found.runId;
    this.repository = found.repository;
    this.commit = found.commit;
    this.mergedAt = found.mergedAt.toISOString();
    this.decisions = found.decisions.map(
      (each) => new DecisionResponseDto(each),
    );
  }
}

export class MergedDecisionListResponseDto {
  @ApiProperty({
    type: [MergedDecisionsResponseDto],
    description: 'Newest merge first, at most fifty',
  })
  readonly merges: MergedDecisionsResponseDto[];

  constructor(found: readonly MergedDecisionsDto[]) {
    this.merges = found.map((each) => new MergedDecisionsResponseDto(each));
  }
}
