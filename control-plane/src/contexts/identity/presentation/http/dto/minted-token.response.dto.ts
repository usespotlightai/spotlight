import type { MintedTokenDto } from '@identity/application/dto/minted-token.dto';
import { ApiProperty } from '@nestjs/swagger';
import { TOKEN_SCOPES } from '@shared-kernel/domain/value-objects/token-scope.vo';

export class MintedTokenResponseDto {
  @ApiProperty({
    example: 'q3Vd0n8yXbT2c4kPzR7mW1sLhA9eJ5gUfN6oYiC0xEw',
    description:
      'The token to send as Authorization: Bearer until it expires; answered this once, and kept only as a hash',
  })
  readonly token: string;

  @ApiProperty({ example: '3f7a2c1d-9b84-4e6f-a05d-7c2e1b9f4a63' })
  readonly tokenId: string;

  @ApiProperty({ example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57' })
  readonly workspaceId: string;

  @ApiProperty({
    enum: TOKEN_SCOPES,
    isArray: true,
    example: ['plan'],
  })
  readonly scopes: readonly string[];

  @ApiProperty({
    example: '2026-09-25T10:15:00.000Z',
    description: 'After this it admits nobody',
  })
  readonly expiresAt: string;

  constructor(minted: MintedTokenDto) {
    this.token = minted.token;
    this.tokenId = minted.tokenId;
    this.workspaceId = minted.workspaceId;
    this.scopes = minted.scopes;
    this.expiresAt = minted.expiresAt;
  }
}
