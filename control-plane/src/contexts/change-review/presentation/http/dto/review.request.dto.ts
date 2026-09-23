import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DraftReviewCommentRequestDto {
  @ApiProperty({ example: 'Should invitations expire?' })
  readonly body!: string;

  @ApiPropertyOptional({ example: 'src/invite.ts' })
  readonly path?: string;

  @ApiPropertyOptional({
    enum: ['new', 'old'],
    description:
      'The side of the change the lines are on; none on the whole file',
  })
  readonly side?: string;

  @ApiPropertyOptional({
    example: 12,
    description: 'The line it ends on; none for a comment on the whole file',
  })
  readonly line?: number;

  @ApiPropertyOptional({
    example: 8,
    nullable: true,
    type: Number,
    description: 'Where a comment on several lines starts, on the same side',
  })
  readonly startLine?: number | null;

  @ApiPropertyOptional({
    description:
      'The comment this answers; the reply lands on its line. A comment on the whole file answers the file’s thread by itself',
  })
  readonly replyTo?: string;
}

export class EditReviewCommentRequestDto {
  @ApiProperty({ example: 'Should invitations expire after a week?' })
  readonly body!: string;
}

export class SubmitReviewRequestDto {
  @ApiProperty({ enum: ['comment', 'approve', 'request-changes'] })
  readonly verdict!: string;

  @ApiPropertyOptional({ example: 'Close; a couple of questions.' })
  readonly body?: string;
}
