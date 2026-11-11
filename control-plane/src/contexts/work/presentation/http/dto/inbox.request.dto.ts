import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnswerInboxItemInputRequestDto {
  @ApiProperty({ example: 'body' })
  readonly name!: string;

  @ApiProperty({ example: 'Fixed in #41.' })
  readonly value!: string;
}

export class AnswerInboxItemRequestDto {
  @ApiProperty({
    example: 'Drain the queue before retrying, and cap it at 500.',
    description:
      'What the person writes back. It joins the task’s trail. May be empty where files are attached.',
  })
  readonly body!: string;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description: 'Uploads to attach, by the id each was granted',
  })
  readonly attachments?: string[];

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Where the conversation asks for a tool call to be approved: true lets it run, false rejects it. Left out, the words answer it and the tool call stays undecided. Rejected anywhere else.',
  })
  readonly approve?: boolean;

  @ApiPropertyOptional({
    type: AnswerInboxItemInputRequestDto,
    isArray: true,
    description:
      'With approve: true on a tool call, what it runs with instead, as the person changed it. Names exactly the inputs it was called with; a harness asking permission takes no changes.',
  })
  readonly inputs?: AnswerInboxItemInputRequestDto[];

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description:
      'The other people who wrote the shared draft with the sender, by user id',
  })
  readonly coAuthors?: string[];

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 0,
    description:
      'The generation of the shared draft this sends. A second send of the same generation is refused, so the draft goes only once',
  })
  readonly draftGeneration?: number | null;
}
