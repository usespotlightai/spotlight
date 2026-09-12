import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisteredHarnessRequestDto {
  @ApiProperty({ example: 'claude-code' })
  readonly id!: string;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['claude-sonnet-5', 'claude-opus-4-8'],
    description:
      'The models this harness reported it can answer with, discovered by ' +
      'the runner from the CLI. Empty where the CLI could not enumerate them.',
  })
  readonly models?: string[];
}

export class RegisterRunnerRequestDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'What the runner advertises. The control plane grants work.',
  })
  readonly capacity?: number;

  @ApiPropertyOptional({
    type: [RegisteredHarnessRequestDto],
    isArray: true,
    description:
      'The harnesses the runner found installed, each with the models it ' +
      'discovered. What is on a machine is a fact about that machine, so the ' +
      'machine is what says it.',
  })
  readonly harnesses?: RegisteredHarnessRequestDto[];
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

  @ApiPropertyOptional({
    example: false,
    description: 'A person stopped the run rather than the agent finishing it.',
  })
  readonly stopped?: boolean;
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

export class RunAttachmentResponseDto {
  @ApiProperty({ example: '5f0c1d84-9c2e-4c8b-9a3d-2b7e6d5a1f47' })
  readonly id: string;

  @ApiProperty({
    example:
      '.spotlight/attachments/5f0c1d84-9c2e-4c8b-9a3d-2b7e6d5a1f47/queue-stuck.png',
    description: 'Where in the workspace to put it',
  })
  readonly path: string;

  constructor(id: string, path: string) {
    this.id = id;
    this.path = path;
  }
}

export class PendingMessageResponseDto {
  @ApiProperty({ example: 4 })
  readonly position: number;

  @ApiProperty({ example: 'Cap the retries at 500 while you are in there.' })
  readonly body: string;

  @ApiProperty({
    type: RunAttachmentResponseDto,
    isArray: true,
    description: 'Files to lay out before the words are given',
  })
  readonly attachments: readonly RunAttachmentResponseDto[];

  constructor(
    position: number,
    body: string,
    attachments: readonly RunAttachmentResponseDto[],
  ) {
    this.position = position;
    this.body = body;
    this.attachments = attachments;
  }
}

export class AnswerRemarkRequestDto {
  @ApiProperty({ example: 'c3', description: 'Which remark, as briefed' })
  readonly handle!: string;

  @ApiProperty({ example: 'Split out in 4a1c2b0.' })
  readonly body!: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Resolve the thread as well as answering it',
  })
  readonly resolve?: boolean;
}

export class OpenPullRequestRequestDto {
  @ApiProperty({ example: 'Fix the queue' })
  readonly title!: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Markdown, shown as the pull request description',
  })
  readonly body?: string | null;

  @ApiPropertyOptional({
    example: 'api',
    nullable: true,
    type: String,
    description:
      'Which of the line’s repositories to open against, by name. Left out ' +
      'where the line works only one.',
  })
  readonly repository?: string | null;
}
