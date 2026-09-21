import { ApiProperty } from '@nestjs/swagger';

export class ToolAnswerResponseDto {
  @ApiProperty({
    description: 'What the tool answered, shaped as the tool shapes it',
    example: 'https://github.com/acme/api/pull/9',
    nullable: true,
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'object' },
      { type: 'array', items: {} },
    ],
  })
  readonly output: unknown;

  constructor(output: unknown) {
    this.output = output;
  }
}

export class ClaimedCheckStepResponseDto {
  @ApiProperty({
    description: 'The whole change, or the layer this step reaches',
    example: 'whole',
  })
  readonly id: string;

  @ApiProperty({ description: 'What to apply on the base before running' })
  readonly patch: string;

  @ApiProperty({
    description: 'Whether a failure here leaves the later steps unrun',
  })
  readonly stopsOnFailure: boolean;

  @ApiProperty({
    description:
      'Whether the checkout must be made ready again once this step applies, ' +
      'because it installs something the step before it did not',
  })
  readonly runsSetup: boolean;

  constructor(
    id: string,
    patch: string,
    stopsOnFailure: boolean,
    runsSetup: boolean,
  ) {
    this.id = id;
    this.patch = patch;
    this.stopsOnFailure = stopsOnFailure;
    this.runsSetup = runsSetup;
  }
}

export class ClaimedCheckResponseDto {
  @ApiProperty({ example: 'stack_1' })
  readonly stackId: string;

  @ApiProperty({ example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  readonly runId: string;

  @ApiProperty({ nullable: true, description: 'Which checkout to check' })
  readonly repository: string | null;

  @ApiProperty({ nullable: true, description: 'The commit to check out' })
  readonly base: string | null;

  @ApiProperty({
    nullable: true,
    description: 'What makes the checkout ready before the check runs',
  })
  readonly setup: string | null;

  @ApiProperty({ example: 'npm test' })
  readonly command: string;

  @ApiProperty({ type: ClaimedCheckStepResponseDto, isArray: true })
  readonly steps: readonly ClaimedCheckStepResponseDto[];

  constructor(
    stackId: string,
    runId: string,
    repository: string | null,
    base: string | null,
    setup: string | null,
    command: string,
    steps: readonly ClaimedCheckStepResponseDto[],
  ) {
    this.stackId = stackId;
    this.runId = runId;
    this.repository = repository;
    this.base = base;
    this.setup = setup;
    this.command = command;
    this.steps = steps;
  }
}

export class ClaimedWorkResponseDto {
  @ApiProperty({ enum: ['run', 'check'] })
  readonly kind: 'run' | 'check';

  @ApiProperty({ type: () => ClaimedRunResponseDto, nullable: true })
  readonly run: ClaimedRunResponseDto | null;

  @ApiProperty({ type: ClaimedCheckResponseDto, nullable: true })
  readonly check: ClaimedCheckResponseDto | null;

  constructor(
    kind: 'run' | 'check',
    run: ClaimedRunResponseDto | null,
    check: ClaimedCheckResponseDto | null,
  ) {
    this.kind = kind;
    this.run = run;
    this.check = check;
  }
}

export class ClaimedRunResponseDto {
  @ApiProperty({ example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  readonly id: string;

  @ApiProperty({
    description: 'Opaque to the control plane, meaningful to the hook',
  })
  readonly spec: unknown;

  constructor(id: string, spec: unknown) {
    this.id = id;
    this.spec = spec;
  }
}

export class EnqueuedRunResponseDto {
  @ApiProperty({ example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  readonly id: string;

  @ApiProperty({ example: 'claude-code' })
  readonly harness: string;

  @ApiProperty({ example: 'queued' })
  readonly state: string;

  @ApiProperty({
    nullable: true,
    example: '8a1d4e0b-6c72-4f35-9b8a-1e5d3c7f2a49',
    description: 'The runner it waits for, or null for whoever is free',
  })
  readonly targetRunnerId: string | null;

  constructor(
    id: string,
    harness: string,
    state: string,
    targetRunnerId: string | null,
  ) {
    this.id = id;
    this.harness = harness;
    this.state = state;
    this.targetRunnerId = targetRunnerId;
  }
}

export class RenewLeaseResponseDto {
  @ApiProperty({
    example: false,
    description: 'Whether a person has asked the runner to stop this run',
  })
  readonly stop: boolean;

  constructor(stop: boolean) {
    this.stop = stop;
  }
}
