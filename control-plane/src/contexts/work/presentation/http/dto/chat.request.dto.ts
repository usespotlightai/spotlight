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
    description:
      'What opens the chat. May be empty where files are attached or traces shared.',
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
    description: 'Tasks whose traces to share with the agent, by task id',
  })
  readonly traces?: string[];

  @ApiPropertyOptional({
    type: String,
    description:
      'A station the chat is about improving, by its id; the agent is briefed to study its recent runs',
  })
  readonly improving?: string;
}

export class SayInChatRequestDto {
  @ApiProperty({
    example: 'Split it into two tasks.',
    description: 'May be empty where files are attached or traces shared.',
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
    description: 'Tasks whose traces to share with the agent, by task id',
  })
  readonly traces?: string[];

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'opus',
    description:
      'The model the agent answers this and later messages with; null for the harness default, left out to keep the chat’s',
  })
  readonly model?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'high',
    description:
      'The effort the agent answers this and later messages with; null for the harness default, left out to keep the chat’s',
  })
  readonly effort?: string | null;
}
