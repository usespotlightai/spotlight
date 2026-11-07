import { ApiProperty } from '@nestjs/swagger';

export class GrantWorkspaceArchiveRequestDto {
  @ApiProperty({
    example: 48_213_551,
    description: 'The archive’s size in bytes, as it will be uploaded',
  })
  readonly size!: number;

  @ApiProperty({
    example: '9f2c1d0e8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f10',
    description: 'The archive’s SHA-256, as 64 hexadecimal digits',
  })
  readonly sha256!: string;
}
