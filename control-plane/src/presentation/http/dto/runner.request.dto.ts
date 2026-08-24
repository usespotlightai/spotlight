import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterRunnerRequestDto {
  @ApiProperty({ example: 'dev' })
  readonly pool!: string;

  @ApiPropertyOptional({ example: { arch: 'arm64' } })
  readonly labels?: Record<string, string>;

  @ApiPropertyOptional({
    example: 1,
    description: 'What the runner advertises. The control plane grants work.',
  })
  readonly capacity?: number;
}

export class RunEventRequestDto {
  @ApiProperty({ example: 1, description: 'Assigned by the runner, gapless' })
  readonly seq!: number;

  @ApiProperty({ example: 'output' })
  readonly type!: string;

  @ApiProperty({ example: '2026-08-23T18:00:00.000Z' })
  readonly at!: string;

  @ApiPropertyOptional()
  readonly message?: string;

  @ApiPropertyOptional({ description: 'Terminal bytes, base64' })
  readonly data?: string;

  @ApiPropertyOptional({ example: 0, description: 'Position in the recording' })
  readonly offset?: number;
}

export class AppendRunEventsRequestDto {
  @ApiProperty({ type: RunEventRequestDto, isArray: true })
  readonly events!: RunEventRequestDto[];
}

export class CompleteRunRequestDto {
  @ApiProperty({ example: 0 })
  readonly exitCode!: number;

  @ApiProperty({ example: false })
  readonly failed!: boolean;

  @ApiPropertyOptional()
  readonly message?: string;
}

export class EnqueueRunRequestDto {
  @ApiProperty({ example: 'dev' })
  readonly pool!: string;

  @ApiProperty({
    description: 'Handed to the runner untouched: checkouts, cwd, command',
    example: {
      cwd: 'service',
      checkouts: [
        { remote: 'https://github.com/org/service', path: 'service' },
      ],
      command: { executable: 'claude', args: ['-p', 'fix the build'] },
    },
  })
  readonly spec!: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Runner this run belongs to. Omitted lets any runner in the pool take it.',
    example: '8a1d4e0b-6c72-4f35-9b8a-1e5d3c7f2a49',
  })
  readonly targetRunnerId?: string;
}
