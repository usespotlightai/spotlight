import type { WorkspaceTokenResourceDto } from '@identity/application/dto/workspace-token-resource.dto';
import { ApiProperty } from '@nestjs/swagger';
import { ResourceResponseDto } from '@platform/http/dto/resource.response.dto';
import { TOKEN_SCOPES } from '@shared-kernel/domain/value-objects/token-scope.vo';

export class WorkspaceTokenResourceResponseDto extends ResourceResponseDto {
  @ApiProperty({
    example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
    description: 'The workspace it acts in, and the only one',
  })
  readonly workspaceId: string;

  @ApiProperty({
    example: 'ci',
    description:
      'Names the token within its workspace; fixed for its life, so changing it means replacing the token',
  })
  readonly name: string;

  @ApiProperty({
    example: 'Applies the platform repository from GitHub Actions',
    description: 'What the token is for',
  })
  readonly description: string;

  @ApiProperty({
    enum: TOKEN_SCOPES,
    isArray: true,
    example: ['configure', 'secrets'],
    description:
      'What it may do: read reads; plan also checks expressions; configure also changes configuration as a workspace admin may, except secrets, runners and token trusts; secrets, granted beside one of those, manages secrets; runners, granted the same way, manages runners, runner trusts and the workspace’s runners; trusts, granted the same way, manages workspace token trusts. Fixed for its life',
  })
  readonly scopes: readonly string[];

  @ApiProperty({
    example: 'kR3vUzPq9sY2mB8nT1wXcA',
    description: 'The person who issued it',
  })
  readonly issuedBy: string;

  @ApiProperty({ example: '2026-09-24T09:30:00.000Z' })
  readonly issuedAt: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '2026-12-31T23:59:59.000Z',
    description:
      'After this Spotlight does not accept it; null never expires. Fixed for its life',
  })
  readonly expiresAt: string | null;

  constructor(token: WorkspaceTokenResourceDto) {
    super(token);
    this.workspaceId = token.workspaceId;
    this.name = token.name;
    this.description = token.description;
    this.scopes = token.scopes;
    this.issuedBy = token.issuedBy;
    this.issuedAt = token.issuedAt;
    this.expiresAt = token.expiresAt;
  }
}
