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

export class HostHarnessResponseDto {
  @ApiProperty({ example: 'claude-code' })
  readonly id: string;

  @ApiProperty({ type: String, nullable: true, example: '2.1.270' })
  readonly version: string | null;

  constructor(fields: HostHarnessResponseDto) {
    this.id = fields.id;
    this.version = fields.version;
  }
}

export class HostImageResponseDto {
  @ApiProperty({ example: 'ghcr.io/acme/api-runner:main' })
  readonly image: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example:
      'ghcr.io/acme/api-runner@sha256:9b2f5c1e0d7a4b3c8e6f1a2d5c7b9e0f3a4d6c8b1e2f5a7c9d0b3e6f8a1c4d7e',
    description: 'The digest its sandboxes start from now',
  })
  readonly digest: string | null;

  @ApiProperty({
    example: true,
    description: 'Runs every line that names no image',
  })
  readonly usual: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '20260925-01',
    description: 'The release of the runner inside',
  })
  readonly release: string | null;

  @ApiProperty({ type: [HostHarnessResponseDto] })
  readonly harnesses: readonly HostHarnessResponseDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'Why the host will not run it, when it will not',
  })
  readonly refused: string | null;

  constructor(fields: HostImageResponseDto) {
    this.image = fields.image;
    this.digest = fields.digest;
    this.usual = fields.usual;
    this.release = fields.release;
    this.harnesses = fields.harnesses.map(
      (each) => new HostHarnessResponseDto(each),
    );
    this.refused = fields.refused;
  }
}

export class HostResponseDto {
  @ApiProperty({ example: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P' })
  readonly id: string;

  @ApiProperty({ example: 'build-box-1' })
  readonly name: string;

  @ApiProperty({ type: AdmittedThroughResponseDto })
  readonly through: AdmittedThroughResponseDto;

  @ApiProperty({ example: 'v1.4.0', description: 'The spotlight release' })
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
    type: [HostImageResponseDto],
    description: 'The runner images it serves or refused, and what each holds',
  })
  readonly images: readonly HostImageResponseDto[];

  @ApiProperty({ example: '2026-09-25T11:00:00.000Z' })
  readonly firstSeenAt: string;

  @ApiProperty({
    example: '2026-09-25T11:30:00.000Z',
    description:
      'When it last came up: started, or answered again after going quiet',
  })
  readonly upSince: string;

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
    this.images = fields.images.map((each) => new HostImageResponseDto(each));
    this.firstSeenAt = fields.firstSeenAt;
    this.upSince = fields.upSince;
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

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'ghcr.io/acme/api-runner:main',
    description:
      'The image its sandbox runs; null where a push pool provisioned it',
  })
  readonly image: string | null;

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
    this.image = fields.image;
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
