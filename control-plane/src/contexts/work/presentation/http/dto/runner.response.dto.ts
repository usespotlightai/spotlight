import { ApiProperty } from '@nestjs/swagger';
import {
  PERMISSION_ANSWERS,
  type PermissionAnswer,
} from '@work/application/dto/permission-answer.dto';
import type { ToolActingAsDto } from '@work/application/ports/integration-tool-calls.port';

export class ToolActingAsResponseDto {
  @ApiProperty({
    description:
      'Whose connection the call used: the team’s, or the person’s who started the task',
    enum: ['team', 'requester'],
    example: 'requester',
  })
  readonly actsAs: 'team' | 'requester';

  @ApiProperty({
    description: 'The person whose connection it was, where it was a person’s',
    example: 'user_1',
    nullable: true,
    type: String,
  })
  readonly personId: string | null;

  @ApiProperty({
    description:
      'The account name on the service of whoever the call acted as, where the service gives it',
    example: '@alice',
    nullable: true,
    type: String,
  })
  readonly linkedAccount: string | null;

  constructor(actingAs: ToolActingAsDto) {
    this.actsAs = actingAs.actsAs;
    this.personId = actingAs.personId;
    this.linkedAccount = actingAs.linkedAccount;
  }
}

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

  @ApiProperty({
    type: ToolActingAsResponseDto,
    nullable: true,
    description:
      'Whose connection the call acted with, where its integration requires a connection',
  })
  readonly actingAs: ToolActingAsResponseDto | null;

  constructor(output: unknown, actingAs: ToolActingAsResponseDto | null) {
    this.output = output;
    this.actingAs = actingAs;
  }
}

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
      'It checks a replay’s change a second time; the runner says so, as recheck=true, when it renews the check’s lease and reports what it found',
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

export class RunCompletionResponseDto {
  @ApiProperty({
    example: false,
    description:
      'Whether the turn ended by asking a person, so the run now waits for their answer instead of ending. The runner keeps its sandbox for the grace period, then suspends the run.',
  })
  readonly waiting: boolean;

  constructor(waiting: boolean) {
    this.waiting = waiting;
  }
}

export class TurnAwaitsPersonResponseDto {
  @ApiProperty({
    example: true,
    description:
      'Whether this turn, as reported, would put the run to a person, so the runner keeps its harness running while it archives the workspace. Otherwise the runner closes the harness first, as the run ends.',
  })
  readonly awaitsPerson: boolean;

  constructor(awaitsPerson: boolean) {
    this.awaitsPerson = awaitsPerson;
  }
}

export class RunSuspensionResponseDto {
  @ApiProperty({
    example: true,
    description:
      'Whether the run is suspended (or, if a stop was requested, ended) and no longer leased by this runner. False when the answer arrived first: the run is working again, and the answer waits in its messages.',
  })
  readonly suspended: boolean;

  constructor(suspended: boolean) {
    this.suspended = suspended;
  }
}

export class RenewCheckLeaseResponseDto {
  @ApiProperty({
    example: false,
    description:
      'Whether the runner should stop checking: the check was deleted ' +
      'with its task, ended, or waited too long to be recorded',
  })
  readonly stop: boolean;

  constructor(stop: boolean) {
    this.stop = stop;
  }
}

export class PermissionAnswerResponseDto {
  @ApiProperty({
    enum: PERMISSION_ANSWERS,
    example: 'asked',
    description:
      'allow or reject answers the harness now; asked means a person was asked in their inbox, so the run should end its turn and release the task',
  })
  readonly decision: PermissionAnswer;

  constructor(decision: PermissionAnswer) {
    this.decision = decision;
  }
}
