import { ApiProperty } from '@nestjs/swagger';

export class CredentialSourceResponseDto {
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
  readonly isDefault: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'v0.3.0',
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
  readonly unavailableReason: string | null;

  constructor(fields: HostImageResponseDto) {
    this.image = fields.image;
    this.digest = fields.digest;
    this.isDefault = fields.isDefault;
    this.release = fields.release;
    this.harnesses = fields.harnesses.map(
      (each) => new HostHarnessResponseDto(each),
    );
    this.unavailableReason = fields.unavailableReason;
  }
}

export class HostResponseDto {
  @ApiProperty({ example: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P' })
  readonly id: string;

  @ApiProperty({ example: 'build-box-1' })
  readonly name: string;

  @ApiProperty({ type: CredentialSourceResponseDto })
  readonly source: CredentialSourceResponseDto;

  @ApiProperty({ example: 'v0.7.0', description: 'The spotlight release' })
  readonly release: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example:
      'Host is on release v0.4.3. Minimum release required: v0.5.1. Update it with: spotlight host update',
    description:
      'Why the control plane gives this host no work, or null when it gives it work',
  })
  readonly unavailableReason: string | null;

  @ApiProperty({ example: 'Docker Engine - Community 27.3.1 (linux/amd64)' })
  readonly containerRuntime: string;

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
    description:
      'The runner images it supports or cannot use, and what each contains',
  })
  readonly images: readonly HostImageResponseDto[];

  @ApiProperty({ example: '2026-09-25T11:00:00.000Z' })
  readonly firstHeartbeatAt: string;

  @ApiProperty({
    example: '2026-09-25T11:30:00.000Z',
    description:
      'When it last came online: it started, or sent a heartbeat again after it was offline',
  })
  readonly onlineSince: string;

  @ApiProperty({ example: '2026-09-25T12:00:00.000Z' })
  readonly lastHeartbeatAt: string;

  @ApiProperty({
    example: true,
    description: 'It sent a heartbeat recently enough to count as online',
  })
  readonly online: boolean;

  constructor(fields: Omit<HostResponseDto, never>) {
    this.id = fields.id;
    this.name = fields.name;
    this.source = fields.source;
    this.release = fields.release;
    this.unavailableReason = fields.unavailableReason;
    this.containerRuntime = fields.containerRuntime;
    this.capacity = fields.capacity;
    this.running = fields.running;
    this.images = fields.images.map((each) => new HostImageResponseDto(each));
    this.firstHeartbeatAt = fields.firstHeartbeatAt;
    this.onlineSince = fields.onlineSince;
    this.lastHeartbeatAt = fields.lastHeartbeatAt;
    this.online = fields.online;
  }
}

export class LiveRunnerResponseDto {
  @ApiProperty({ example: '8a1d4e0b-6c72-4f35-9b8a-1e5d3c7f2a49' })
  readonly id: string;

  @ApiProperty({ type: CredentialSourceResponseDto })
  readonly source: CredentialSourceResponseDto;

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
  readonly lastHeartbeatAt: string | null;

  constructor(fields: Omit<LiveRunnerResponseDto, never>) {
    this.id = fields.id;
    this.source = fields.source;
    this.hostId = fields.hostId;
    this.image = fields.image;
    this.harnesses = fields.harnesses;
    this.startedAt = fields.startedAt;
    this.lastHeartbeatAt = fields.lastHeartbeatAt;
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
