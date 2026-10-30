import { ApiProperty } from '@nestjs/swagger';
import { ClaimedWorkResponseDto } from '@work/presentation/http/dto/runner.response.dto';

export class HostClaimResponseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: '9c4e1a7b-2d58-4f36-8b0e-6a1f3c9d7e24',
    description:
      'The one-run runner Spotlight started for this work. Null for a sandbox with no run.',
  })
  readonly runnerId: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The one-run credential, good only for this work and only until it ends; every later call carries it instead of the host’s own credential. Null for a sandbox with no run.',
  })
  readonly token: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The credential the egress sidecar fetches the run’s secrets with; the host hands it to egress alone, never into the sandbox. Null for a sandbox with no run: its egress starts with no secrets.',
  })
  readonly egressToken: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '5d2e8f1a-7c4b-4e9a-b3f6-1a8d0c7e2b95',
    description:
      'The sandbox Spotlight started for a run; the host labels its container with it and reports it in each heartbeat. Null for a check.',
  })
  readonly sandboxId: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The credential of a new sandbox, for its own calls only: restore and archive its workspace. The host hands it into the sandbox with the first assignment. Null when the run reuses a live sandbox, and for a check.',
  })
  readonly sandboxToken: string | null;

  @ApiProperty({
    type: [String],
    example: ['spotlight-archives.s3.eu-west-1.amazonaws.com'],
    description:
      'Hosts the egress of a sandbox with no run lets through: where the sandbox restores and stores its workspace archives. Empty for a run: its egress reads them with the run’s secrets.',
  })
  readonly allowedHosts: readonly string[];

  @ApiProperty({
    example: false,
    description:
      'The run goes into the live sandbox the claim named, not into a new one. The host delivers its assignment into that container.',
  })
  readonly reused: boolean;

  @ApiProperty({ type: ClaimedWorkResponseDto })
  readonly work: ClaimedWorkResponseDto;

  constructor(input: {
    runnerId: string | null;
    token: string | null;
    egressToken: string | null;
    sandboxId: string | null;
    sandboxToken: string | null;
    allowedHosts: readonly string[];
    reused: boolean;
    work: ClaimedWorkResponseDto;
  }) {
    this.runnerId = input.runnerId;
    this.token = input.token;
    this.egressToken = input.egressToken;
    this.sandboxId = input.sandboxId;
    this.sandboxToken = input.sandboxToken;
    this.allowedHosts = input.allowedHosts;
    this.reused = input.reused;
    this.work = input.work;
  }
}
