import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClaimHostWorkRequestDto {
  @ApiProperty({
    example: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P',
    description: 'The host claiming, as it names itself in its heartbeat',
  })
  readonly host!: string;

  @ApiProperty({
    example: 'ghcr.io/acme/api-runner:main',
    description:
      'The runner image this claim will run in, one the host reported that it supports; what it contains and whether it is the default come from that report',
  })
  readonly image!: string;

  @ApiPropertyOptional({
    example: '5d2e8f1a-7c4b-4e9a-b3f6-1a8d0c7e2b95',
    description:
      'A live sandbox of this host that has no run in it. The claim then takes only a queued run of the task or chat whose workspace that sandbox keeps, and delivers it into that sandbox. The sandbox already holds a capacity slot.',
  })
  readonly sandbox?: string;
}
