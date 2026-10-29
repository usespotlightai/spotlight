import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { FailureCauseRecorded } from '@replays/application/dto/replay-outcomes.dto';
import {
  FAILURE_CAUSES,
  MAX_CAUSE_TEXT,
} from '@replays/domain/value-objects/failure-cause.vo';

const SEARCH_CANDIDATE_SLUG =
  'lowercase letters, digits and hyphens, starting with a letter or digit, at most 63 characters';

export class ProposeSearchCandidateRequestDto {
  @ApiProperty({
    example: 'terse-prompt',
    description: `A slug unique in the search: ${SEARCH_CANDIDATE_SLUG}`,
  })
  readonly name!: string;

  @ApiProperty({
    example: 'A shorter prompt keeps it on the failing test.',
    description: 'What the candidate is expected to improve, and why',
  })
  readonly hypothesis!: string;

  @ApiProperty({
    type: Object,
    description:
      'The station block, as the line stores it, changed only where a search may change it',
  })
  readonly station!: Record<string, unknown>;
}

export class SearchCandidateProposedResponseDto {
  @ApiProperty()
  readonly candidateId: string;

  @ApiProperty({ example: 'terse-prompt' })
  readonly name: string;

  @ApiProperty({
    description: 'Its replay on the search’s searched tasks, started now',
  })
  readonly replayId: string;

  constructor(proposed: {
    readonly candidateId: string;
    readonly name: string;
    readonly replayId: string;
  }) {
    this.candidateId = proposed.candidateId;
    this.name = proposed.name;
    this.replayId = proposed.replayId;
  }
}

export class RecordFailureCauseRequestDto {
  @ApiProperty({
    description:
      'A failing task the reflection’s briefing lists, by its task id',
  })
  readonly taskId!: string;

  @ApiProperty({
    enum: FAILURE_CAUSES,
    description:
      'config when a change to the station’s config could fix it; task when the task itself is why; judge when the judge scored it wrong; check when the check failed for a reason the change did not cause; infra when the run failed around the work',
  })
  readonly cause!: string;

  @ApiProperty({
    description: `What in the runs shows the cause, in 1 to ${MAX_CAUSE_TEXT} characters`,
  })
  readonly evidence!: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: `What a person, or the next iteration, should change, in at most ${MAX_CAUSE_TEXT} characters`,
  })
  readonly suggestion?: string | null;
}

export class FailureCauseRecordedResponseDto {
  @ApiProperty()
  readonly taskId: string;

  @ApiProperty({ enum: FAILURE_CAUSES })
  readonly cause: string;

  @ApiProperty({ description: 'The failing replay run the cause is about' })
  readonly replayRunId: string;

  constructor(recorded: FailureCauseRecorded) {
    this.taskId = recorded.taskId;
    this.cause = recorded.cause;
    this.replayRunId = recorded.replayRunId;
  }
}
