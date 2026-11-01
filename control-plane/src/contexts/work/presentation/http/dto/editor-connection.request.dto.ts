import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConnectEditorRequestDto {
  @ApiPropertyOptional({
    example: '4f1d2b9e-7c3a-4e8b-a6d5-0b9c8e7f6a51',
    description: 'The task whose sandbox to open. Name a task or a chat.',
  })
  readonly task?: string;

  @ApiPropertyOptional({
    example: '7a3c1e9d-2b4f-4d6a-8c5e-1f0b9a8d7c62',
    description: 'The chat whose sandbox to open. Name a task or a chat.',
  })
  readonly chat?: string;

  @ApiPropertyOptional({
    example: 'acme',
    description: 'The workspace the task or chat must be in',
  })
  readonly workspace?: string;
}
