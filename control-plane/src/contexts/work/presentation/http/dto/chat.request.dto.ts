import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatSetupRequestDto {
  @ApiProperty({
    example: 'acme/infra',
    description: 'The repository the team’s configuration lives in',
  })
  readonly repository!: string;

  @ApiProperty({
    example: 'spotlight',
    description: 'The folder in it, from the repository root',
  })
  readonly folder!: string;
}

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
      'The id of the station that the chat must improve. The agent gets an instruction to study the recent runs of the station',
  })
  readonly targetStation?: string;

  @ApiPropertyOptional({
    type: () => ChatSetupRequestDto,
    description:
      'Makes this the team’s setup chat: the agent surveys the team’s tools and opens a pull request with its configuration as code there',
  })
  readonly setup?: ChatSetupRequestDto;
}

export class SendChatMessageRequestDto {
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
