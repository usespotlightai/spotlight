import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GrantAttachmentUploadRequestDto {
  @ApiProperty({ example: 'queue-stuck.png' })
  readonly name!: string;

  @ApiPropertyOptional({
    example: 'image/png',
    description: 'Left out where the browser could not tell',
  })
  readonly contentType?: string;

  @ApiProperty({ example: 48213, description: 'In bytes, at most 25 MB' })
  readonly size!: number;
}
