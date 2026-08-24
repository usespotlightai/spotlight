import { ApiPropertyOptional } from '@nestjs/swagger';

export class SendRunInputRequestDto {
  @ApiPropertyOptional({
    example: 'bHMgLWxhCg==',
    description: 'Keystrokes as base64, exactly as the terminal produced them',
  })
  readonly data?: string;

  @ApiPropertyOptional({ example: 120, description: 'New terminal width' })
  readonly cols?: number;

  @ApiPropertyOptional({ example: 40, description: 'New terminal height' })
  readonly rows?: number;
}
