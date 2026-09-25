import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PoolHarnessRequestDto {
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
    description: 'The release of this harness installed where the runner runs',
  })
  readonly version?: string;
}

export class ClaimPoolWorkRequestDto {
  @ApiPropertyOptional({
    type: [PoolHarnessRequestDto],
    isArray: true,
    description:
      'The harnesses installed where the runner runs, as registering reports them',
  })
  readonly harnesses?: PoolHarnessRequestDto[];
}
