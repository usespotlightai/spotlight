import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterRunnerRequestDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'What the runner advertises. The control plane grants work.',
  })
  readonly capacity?: number;

  @ApiPropertyOptional({
    example: ['claude-code'],
    type: [String],
    isArray: true,
    description:
      'The harnesses the runner found installed. What is on a machine is a ' +
      'fact about that machine, so the machine is what says it.',
  })
  readonly harnesses?: string[];
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

export class DeclaredOutcomeDto {
  @ApiProperty({
    example: 'Spec',
    description:
      'The station to pass the task to, or "review" to ask a person. A name this line does not know is treated as a question for a person.',
  })
  readonly next!: string;

  @ApiPropertyOptional({
    example: 'Reproduced on restart. Needs a spec for draining the queue.',
    description: 'What the next station, or the person, should know',
  })
  readonly note?: string;
}

export class CompleteRunRequestDto {
  @ApiProperty({ example: 0 })
  readonly exitCode!: number;

  @ApiProperty({ example: false })
  readonly failed!: boolean;

  @ApiPropertyOptional()
  readonly message?: string;

  @ApiPropertyOptional({ type: DeclaredOutcomeDto })
  readonly outcome?: DeclaredOutcomeDto;

  @ApiPropertyOptional({
    example: '67e5ddad-0fc6-4a33-90df-3c17732132c8',
    description:
      'What the harness called this conversation. Reported rather than ' +
      'remembered by the runner, because the next run may fall to another one.',
  })
  readonly sessionId?: string;
}

export class EnqueueRunRequestDto {
  @ApiProperty({
    example: 'claude-code',
    description:
      'The harness to work this run. Only runners that have it may take it.',
  })
  readonly harness!: string;

  @ApiProperty({
    description:
      'Handed to the runner untouched: checkouts and cwd. The command is ' +
      'filled in from the harness, so it is not given here.',
    example: {
      cwd: 'service',
      checkouts: [
        { remote: 'https://github.com/org/service', path: 'service' },
      ],
    },
  })
  readonly spec!: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Runner this run belongs to. Omitted lets any runner with the harness take it.',
    example: '8a1d4e0b-6c72-4f35-9b8a-1e5d3c7f2a49',
  })
  readonly targetRunnerId?: string;
}

export class DeliverSaidRequestDto {
  @ApiProperty({
    example: 4,
    description: 'Everything said up to and including this note was given',
  })
  readonly upTo!: number;
}

export class PendingMessageResponseDto {
  @ApiProperty({ example: 4 })
  readonly position: number;

  @ApiProperty({ example: 'Cap the retries at 500 while you are in there.' })
  readonly body: string;

  constructor(position: number, body: string) {
    this.position = position;
    this.body = body;
  }
}
