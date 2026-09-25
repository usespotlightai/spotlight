import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HostHarnessRequestDto {
  @ApiProperty({ example: 'claude-code' })
  readonly id!: string;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['claude-sonnet-5'],
    description:
      'The models this harness reported it can answer with, discovered from the CLI',
  })
  readonly models?: string[];

  @ApiPropertyOptional({
    example: '2.1.270',
    description: 'The release of this harness in the runner image',
  })
  readonly version?: string;
}

export class ClaimHostWorkRequestDto {
  @ApiProperty({
    example: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P',
    description: 'The host claiming, as it names itself in its presence',
  })
  readonly host!: string;

  @ApiPropertyOptional({
    type: [HostHarnessRequestDto],
    isArray: true,
    description:
      'The harnesses in the runner image this claim will run in, as the host found them',
  })
  readonly harnesses?: HostHarnessRequestDto[];
}
