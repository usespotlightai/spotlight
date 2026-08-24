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

  @ApiProperty({ example: 'default' })
  readonly pool: string;

  @ApiProperty({
    example: { runner: 'one' },
    additionalProperties: { type: 'string' },
    description: 'What the runner advertises about itself; a hint, not a grant',
  })
  readonly labels: Record<string, string>;

  @ApiProperty({ example: '2026-08-24T11:00:00.000Z' })
  readonly registeredAt: string;

  @ApiProperty({ example: '2026-08-24T12:00:00.000Z' })
  readonly lastSeenAt: string;

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
    pool: string,
    labels: Record<string, string>,
    registeredAt: string,
    lastSeenAt: string,
    connected: boolean,
    currentRun: ActiveRunResponseDto | null,
  ) {
    this.id = id;
    this.pool = pool;
    this.labels = labels;
    this.registeredAt = registeredAt;
    this.lastSeenAt = lastSeenAt;
    this.connected = connected;
    this.currentRun = currentRun;
  }
}
