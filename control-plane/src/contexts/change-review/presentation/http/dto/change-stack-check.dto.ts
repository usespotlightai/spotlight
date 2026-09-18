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

export class RecordChangeStackCheckRequestDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Why the runner could not check the stack at all',
  })
  readonly skipped?: string | null;

  @ApiPropertyOptional({ type: CheckedStepRequestDto, isArray: true })
  readonly steps?: CheckedStepRequestDto[];
}

export class ChangeStackCheckStepResponseDto {
  @ApiProperty({ example: 'c1.l1' })
  readonly id: string;

  @ApiProperty({
    description: 'What to apply to where the run began, as git apply takes it',
  })
  readonly patch: string;

  constructor(id: string, patch: string) {
    this.id = id;
    this.patch = patch;
  }
}

export class ChangeStackCheckResponseDto {
  @ApiProperty()
  readonly stackId: string;

  @ApiProperty({ nullable: true, type: String })
  readonly repository: string | null;

  @ApiProperty({ example: 'npx tsc --noEmit' })
  readonly command: string;

  @ApiProperty({
    type: ChangeStackCheckStepResponseDto,
    isArray: true,
    description:
      'The whole change first, then each layer with the layers before it',
  })
  readonly steps: readonly ChangeStackCheckStepResponseDto[];

  constructor(
    stackId: string,
    repository: string | null,
    command: string,
    steps: readonly ChangeStackCheckStepResponseDto[],
  ) {
    this.stackId = stackId;
    this.repository = repository;
    this.command = command;
    this.steps = steps;
  }
}

export class ChangeStackChecksResponseDto {
  @ApiProperty({
    description: 'Whether a stack with a check is still being drafted',
  })
  readonly waiting: boolean;

  @ApiProperty({ type: ChangeStackCheckResponseDto, isArray: true })
  readonly checks: readonly ChangeStackCheckResponseDto[];

  constructor(
    waiting: boolean,
    checks: readonly ChangeStackCheckResponseDto[],
  ) {
    this.waiting = waiting;
    this.checks = checks;
  }
}
