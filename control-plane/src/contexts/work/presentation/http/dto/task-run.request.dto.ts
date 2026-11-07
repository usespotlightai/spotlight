import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageRequestDto {
  @ApiProperty({
    example: 'Cap the retries at 500 while you are in there.',
    description:
      'Goes to the agent when its current turn ends. May be empty where files are attached.',
  })
  readonly body!: string;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description: 'Uploads to attach, by the id each was granted',
  })
  readonly attachments?: string[];

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
