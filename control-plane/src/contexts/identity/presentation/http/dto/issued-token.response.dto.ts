import type { IssuedTokenDto } from '@identity/application/dto/issued-token.dto';
import { ApiProperty } from '@nestjs/swagger';
import { TOKEN_SCOPES } from '@shared-kernel/domain/value-objects/token-scope.vo';

export class IssuedTokenResponseDto {
  @ApiProperty({
    example: 'q3Vd0n8yXbT2c4kPzR7mW1sLhA9eJ5gUfN6oYiC0xEw',
    description:
      'The token to send as Authorization: Bearer until it expires; returned once, and stored only as a hash',
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
    description: 'After this Spotlight does not accept it',
  })
  readonly expiresAt: string;

  constructor(issued: IssuedTokenDto) {
    this.token = issued.token;
    this.tokenId = issued.tokenId;
    this.workspaceId = issued.workspaceId;
    this.scopes = issued.scopes;
    this.expiresAt = issued.expiresAt;
  }
}
