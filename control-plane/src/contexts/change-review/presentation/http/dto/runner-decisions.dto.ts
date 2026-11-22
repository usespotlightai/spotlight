import { DECISION_KIND_NAMES } from '@change-review/application/dto/decision.dto';
import { ApiProperty } from '@nestjs/swagger';

export class RecordedDecisionRequestDto {
  @ApiProperty({ enum: DECISION_KIND_NAMES })
  readonly kind!: (typeof DECISION_KIND_NAMES)[number];

  @ApiProperty({
    example: 'Retries uploads in the request, not from a queue',
    description: 'What the agent chose, at most 120 characters',
  })
  readonly title!: string;

  @ApiProperty({
    description:
      'What led the agent to it, and what it costs, at most 2000 characters',
  })
  readonly why!: string;

  @ApiProperty({
    type: [String],
    description: 'At most five options the agent weighed and set aside',
  })
  readonly alternatives!: string[];

  @ApiProperty({
    type: [String],
    example: ['api/src/uploads.ts'],
    description:
      'One to twenty changed files it covers, from the working copy root',
  })
  readonly paths!: string[];
}

export class RecordDecisionsRequestDto {
  @ApiProperty({
    type: [RecordedDecisionRequestDto],
    description: 'One to twenty decisions',
  })
  readonly decisions!: RecordedDecisionRequestDto[];
}

export class RecordedDecisionsResponseDto {
  @ApiProperty({
    type: [String],
    description:
      'The id of each decision among the task’s decisions, in the order sent. A decision the task holds already keeps its id',
  })
  readonly ids: string[];

  constructor(ids: readonly string[]) {
    this.ids = [...ids];
  }
}
