import { ApiProperty } from '@nestjs/swagger';

export class ConnectedRunnerResponseDto {
  @ApiProperty({ example: '8a1d4e0b-6c72-4f35-9b8a-1e5d3c7f2a49' })
  readonly id: string;

  @ApiProperty({ example: 'Build server' })
  readonly name: string;

  @ApiProperty({ example: 'dev' })
  readonly harnesses: readonly string[];

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

  constructor(
    id: string,
    name: string,
    harnesses: readonly string[],
    registeredAt: string,
    lastSeenAt: string | null,
    revokedAt: string | null,
    connected: boolean,
  ) {
    this.id = id;
    this.name = name;
    this.harnesses = harnesses;
    this.registeredAt = registeredAt;
    this.lastSeenAt = lastSeenAt;
    this.revokedAt = revokedAt;
    this.connected = connected;
  }
}

export class EnrolledRunnerResponseDto {
  @ApiProperty({ example: '8a1d4e0b-6c72-4f35-9b8a-1e5d3c7f2a49' })
  readonly id: string;

  @ApiProperty({ example: 'Build server' })
  readonly name: string;

  @ApiProperty({
    example: 'xY3...',
    description: 'Shown once. Nothing can recover it after this response.',
  })
  readonly token: string;

  constructor(id: string, name: string, token: string) {
    this.id = id;
    this.name = name;
    this.token = token;
  }
}
