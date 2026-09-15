import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartChatRequestDto {
  @ApiProperty({
    example: 'claude-code',
    description: 'The harness to talk to',
  })
  readonly harness!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'claude-opus-5',
    description: 'The harness’s default where left out',
  })
  readonly model?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'high',
    description: 'The harness’s default where left out',
  })
  readonly effort?: string | null;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['acme/api'],
    description: 'Checked out for the agent to read',
  })
  readonly repositories?: string[];

  @ApiProperty({
    example: 'Let’s plan how retries should back off.',
    description: 'What opens the chat. May be empty where files are attached.',
  })
  readonly body!: string;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description: 'Uploads to attach, by the id each was granted',
  })
  readonly attachments?: string[];
}

export class SayInChatRequestDto {
  @ApiProperty({
    example: 'Split it into two tasks.',
    description: 'May be empty where files are attached.',
  })
  readonly body!: string;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description: 'Uploads to attach, by the id each was granted',
  })
  readonly attachments?: string[];
}
