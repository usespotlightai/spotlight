import { ApiProperty } from '@nestjs/swagger';

export class RegisteredRunnerResponseDto {
  @ApiProperty({ example: '3fd46417-95af-4c8b-9a3d-2b7e5f0c1d84' })
  readonly runnerId: string;

  constructor(runnerId: string) {
    this.runnerId = runnerId;
  }
}

export class ClaimedRunResponseDto {
  @ApiProperty({ example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  readonly id: string;

  @ApiProperty({
    description: 'Opaque to the control plane, meaningful to the hook',
  })
  readonly spec: unknown;

  @ApiProperty({ example: '2026-08-23T18:01:00.000Z' })
  readonly leaseExpiresAt: string;

  constructor(id: string, spec: unknown, leaseExpiresAt: string) {
    this.id = id;
    this.spec = spec;
    this.leaseExpiresAt = leaseExpiresAt;
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
