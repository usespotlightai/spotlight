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

  @ApiProperty({ example: 'dev' })
  readonly pool: string;

  @ApiProperty({ example: 'queued' })
  readonly state: string;

  constructor(id: string, pool: string, state: string) {
    this.id = id;
    this.pool = pool;
    this.state = state;
  }
}
