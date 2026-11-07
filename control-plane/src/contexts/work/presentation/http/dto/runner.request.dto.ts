import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AckMessagesRequestDto {
  @ApiProperty({
    example: 4,
    description: 'The agent got all the messages up to and including this note',
  })
  readonly upTo!: number;
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
