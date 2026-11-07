import { ApiProperty } from '@nestjs/swagger';

export class ClaimedCheckStepResponseDto {
  @ApiProperty({
    description: 'The whole change, or the layer this step covers',
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

  @ApiProperty({
    description:
      'It is a repeat check; the runner says so, as recheck=true, when it renews the check’s lease and reports what it found',
  })
  readonly recheck: boolean;

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
    recheck: boolean,
    runId: string,
    repository: string | null,
    base: string | null,
    setup: string | null,
    command: string,
    steps: readonly ClaimedCheckStepResponseDto[],
  ) {
    this.stackId = stackId;
    this.recheck = recheck;
    this.runId = runId;
    this.repository = repository;
    this.base = base;
    this.setup = setup;
    this.command = command;
    this.steps = steps;
  }
}

export class ClaimedWorkResponseDto {
  @ApiProperty({
    enum: ['run', 'check', 'sandbox'],
    description:
      '`sandbox` is only for a host claim: start a sandbox with no run in it',
  })
  readonly kind: 'run' | 'check' | 'sandbox';

  @ApiProperty({ type: () => ClaimedRunResponseDto, nullable: true })
  readonly run: ClaimedRunResponseDto | null;

  @ApiProperty({ type: ClaimedCheckResponseDto, nullable: true })
  readonly check: ClaimedCheckResponseDto | null;

  constructor(
    kind: 'run' | 'check' | 'sandbox',
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
    example: 'claude-code',
    description:
      'The harness the run needs, so a host can tell whether the image it pulled still contains it',
  })
  readonly harness: string;

  @ApiProperty({
    example: 1,
    description:
      'Which attempt of the run this is, so what the runner reports for it is not taken for a later one',
  })
  readonly attempt: number;

  @ApiProperty({
    description: 'What the runner lays out and starts, as the runner reads it',
  })
  readonly spec: unknown;

  constructor(id: string, harness: string, attempt: number, spec: unknown) {
    this.id = id;
    this.harness = harness;
    this.attempt = attempt;
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

  constructor(id: string, harness: string, state: string) {
    this.id = id;
    this.harness = harness;
    this.state = state;
  }
}

export class RenewLeaseResponseDto {
  @ApiProperty({
    example: false,
    description: 'Whether a person has requested that the runner stop this run',
  })
  readonly stop: boolean;

  constructor(stop: boolean) {
    this.stop = stop;
  }
}

export class RenewCheckLeaseResponseDto {
  @ApiProperty({
    example: false,
    description:
      'Whether the runner should stop checking: the check was deleted, ' +
      'ended, or waited too long to be recorded',
  })
  readonly stop: boolean;

  constructor(stop: boolean) {
    this.stop = stop;
  }
}
