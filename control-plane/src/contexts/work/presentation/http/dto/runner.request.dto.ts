import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AckMessagesRequestDto {
  @ApiProperty({
    example: 4,
    description: 'The agent got all the messages up to and including this note',
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
    description: 'Files to lay out before the words are sent',
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

export class ReplyToReviewCommentRequestDto {
  @ApiProperty({
    example: 'c3',
    description: 'Which review comment, as the briefing named it',
  })
  readonly handle!: string;

  @ApiProperty({ example: 'Split out in 4a1c2b0.' })
  readonly body!: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Resolve the thread as well as replying to it',
  })
  readonly resolve?: boolean;
}

export class AskPermissionRequestDto {
  @ApiPropertyOptional({
    example: '0f6c2b1e-4d7a-4b8e-9c21-5a3e7d9f1b60',
    description:
      'The harness session asking, so the run that takes the task up again after the answer carries on in it',
  })
  readonly sessionId?: string;

  @ApiPropertyOptional({
    example: 'execute',
    description:
      'The ACP tool kind the harness sent, as in read, edit or execute',
  })
  readonly kind?: string;

  @ApiPropertyOptional({
    example: '`git push origin main`',
    description: 'What the harness said it wants to do',
  })
  readonly title?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { command: 'git push origin main' },
    description: 'The tool call’s raw input, as the harness sent it',
  })
  readonly input?: unknown;
}
