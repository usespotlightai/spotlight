import { ApiProperty } from '@nestjs/swagger';

export class ActiveRunResponseDto {
  @ApiProperty({ example: '3f9c1b7e-52a4-4d6f-8e1b-0a7c4d2f9b63' })
  readonly id: string;

  @ApiProperty({ example: 'claimed' })
  readonly state: string;

  constructor(id: string, state: string) {
    this.id = id;
    this.state = state;
  }
}

export class ConnectedRunnerResponseDto {
  @ApiProperty({ example: '8a1d4e0b-6c72-4f35-9b8a-1e5d3c7f2a49' })
  readonly id: string;

  @ApiProperty({ example: 'Build server' })
  readonly alias: string;

  @ApiProperty({ example: 'dev' })
  readonly pool: string;

  @ApiProperty({ example: '2026-08-24T11:00:00.000Z' })
  readonly registeredAt: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '2026-08-24T12:00:00.000Z',
    description: 'Null when the runner has never connected',
  })
  readonly lastSeenAt: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'When its token was retired, if it has been',
  })
  readonly revokedAt: string | null;

  @ApiProperty({
    example: true,
    description: 'Heard from recently enough to be counted on',
  })
  readonly connected: boolean;

  @ApiProperty({
    type: ActiveRunResponseDto,
    nullable: true,
    description: 'The run it is working on, or null when idle',
  })
  readonly currentRun: ActiveRunResponseDto | null;

  constructor(
    id: string,
    alias: string,
    pool: string,
    registeredAt: string,
    lastSeenAt: string | null,
    revokedAt: string | null,
    connected: boolean,
    currentRun: ActiveRunResponseDto | null,
  ) {
    this.id = id;
    this.alias = alias;
    this.pool = pool;
    this.registeredAt = registeredAt;
    this.lastSeenAt = lastSeenAt;
    this.revokedAt = revokedAt;
    this.connected = connected;
    this.currentRun = currentRun;
  }
}

export class EnrolledRunnerResponseDto {
  @ApiProperty({ example: '8a1d4e0b-6c72-4f35-9b8a-1e5d3c7f2a49' })
  readonly id: string;

  @ApiProperty({ example: 'Build server' })
  readonly alias: string;

  @ApiProperty({
    example: 'spot_xY3...',
    description: 'Shown once. Nothing can recover it after this response.',
  })
  readonly token: string;

  constructor(id: string, alias: string, token: string) {
    this.id = id;
    this.alias = alias;
    this.token = token;
  }
}
