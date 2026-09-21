import { REPORTED_SKIPS } from '@change-review/domain/value-objects/stack-check.vo';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckedStepRequestDto {
  @ApiProperty({
    example: 'c1.l2',
    description: 'The step it ran: "whole", or the layer it checked',
  })
  readonly step!: string;

  @ApiProperty()
  readonly passed!: boolean;

  @ApiProperty({ description: 'The end of what the check printed' })
  readonly output!: string;

  @ApiProperty({ example: 42_000 })
  readonly tookMs!: number;
}

export class SkippedCheckRequestDto {
  @ApiProperty({
    enum: REPORTED_SKIPS,
    description: 'Why the runner could not check the stack at all',
  })
  readonly code!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'What it printed while trying, where that helps',
  })
  readonly detail?: string | null;
}

export class RecordChangeStackCheckRequestDto {
  @ApiPropertyOptional({
    type: SkippedCheckRequestDto,
    nullable: true,
    description: 'Set where the stack could not be checked at all',
  })
  readonly skipped?: SkippedCheckRequestDto | null;

  @ApiPropertyOptional({ type: CheckedStepRequestDto, isArray: true })
  readonly steps?: CheckedStepRequestDto[];
}
