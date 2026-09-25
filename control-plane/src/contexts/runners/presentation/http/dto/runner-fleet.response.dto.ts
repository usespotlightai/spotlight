import { ApiProperty } from '@nestjs/swagger';

export class AdmittedThroughResponseDto {
  @ApiProperty({ enum: ['pool', 'trust'], example: 'pool' })
  readonly kind: 'pool' | 'trust';

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'build-farm',
    description: 'The pool’s or trust’s key; null once it is gone',
  })
  readonly key: string | null;

  constructor(kind: 'pool' | 'trust', key: string | null) {
    this.kind = kind;
    this.key = key;
  }
}

export class HostResponseDto {
  @ApiProperty({ example: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P' })
  readonly id: string;

  @ApiProperty({ example: 'build-box-1' })
  readonly name: string;

  @ApiProperty({ type: AdmittedThroughResponseDto })
  readonly through: AdmittedThroughResponseDto;

  @ApiProperty({ example: 'v1.4.0', description: 'The spotlight-host release' })
  readonly release: string;

  @ApiProperty({ example: 'Docker Engine - Community 27.3.1 (linux/amd64)' })
  readonly executor: string;

  @ApiProperty({
    example: 4,
    description: 'How many sandboxes it runs at once',
  })
  readonly capacity: number;

  @ApiProperty({
    type: String,
    isArray: true,
    description: 'The one-run runners in its sandboxes now',
  })
  readonly running: readonly string[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['claude-code', 'codex'],
    description: 'The harnesses its runner images hold',
  })
  readonly harnesses: readonly string[];

  @ApiProperty({ example: '2026-09-25T11:00:00.000Z' })
  readonly firstSeenAt: string;

  @ApiProperty({ example: '2026-09-25T12:00:00.000Z' })
  readonly lastSeenAt: string;

  @ApiProperty({
    example: true,
    description: 'Heard from recently enough to be counted on',
  })
  readonly answering: boolean;

  constructor(fields: Omit<HostResponseDto, never>) {
    this.id = fields.id;
    this.name = fields.name;
    this.through = fields.through;
    this.release = fields.release;
    this.executor = fields.executor;
    this.capacity = fields.capacity;
    this.running = fields.running;
    this.harnesses = fields.harnesses;
    this.firstSeenAt = fields.firstSeenAt;
    this.lastSeenAt = fields.lastSeenAt;
    this.answering = fields.answering;
  }
}

export class LiveRunnerResponseDto {
  @ApiProperty({ example: '8a1d4e0b-6c72-4f35-9b8a-1e5d3c7f2a49' })
  readonly id: string;

  @ApiProperty({ type: AdmittedThroughResponseDto })
  readonly through: AdmittedThroughResponseDto;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The host whose sandbox it runs in; null where a push pool provisioned it',
  })
  readonly hostId: string | null;

  @ApiProperty({ type: String, isArray: true, example: ['claude-code'] })
  readonly harnesses: readonly string[];

  @ApiProperty({ example: '2026-09-25T11:00:00.000Z' })
  readonly startedAt: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '2026-09-25T11:05:00.000Z',
  })
  readonly lastSeenAt: string | null;

  constructor(fields: Omit<LiveRunnerResponseDto, never>) {
    this.id = fields.id;
    this.through = fields.through;
    this.hostId = fields.hostId;
    this.harnesses = fields.harnesses;
    this.startedAt = fields.startedAt;
    this.lastSeenAt = fields.lastSeenAt;
  }
}

export class RunnerFleetResponseDto {
  @ApiProperty({ type: [HostResponseDto] })
  readonly hosts: readonly HostResponseDto[];

  @ApiProperty({
    type: [LiveRunnerResponseDto],
    description:
      'Every runner at work now, one per run, on a host or provisioned by a push pool',
  })
  readonly runners: readonly LiveRunnerResponseDto[];

  constructor(
    hosts: readonly HostResponseDto[],
    runners: readonly LiveRunnerResponseDto[],
  ) {
    this.hosts = hosts;
    this.runners = runners;
  }
}
