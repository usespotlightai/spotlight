import type { WorkspaceTokenTrustResourceDto } from '@identity/application/dto/workspace-token-trust-resource.dto';
import { ApiProperty } from '@nestjs/swagger';
import { ResourceResponseDto } from '@platform/http/dto/resource.response.dto';
import { TOKEN_SCOPES } from '@shared-kernel/domain/value-objects/token-scope.vo';

export class WorkspaceTokenTrustResourceResponseDto extends ResourceResponseDto {
  @ApiProperty({
    example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
    description: 'The workspace the tokens it mints act in',
  })
  readonly workspaceId: string;

  @ApiProperty({
    example: 'github-main',
    description:
      'Names the trust within its workspace, and every token it mints; fixed for its life',
  })
  readonly key: string;

  @ApiProperty({
    example: 'https://token.actions.githubusercontent.com',
    description: 'The OIDC issuer whose signed tokens the trust accepts',
  })
  readonly issuer: string;

  @ApiProperty({
    example: 'spotlight',
    description: 'The audience the workload must ask its issuer for',
  })
  readonly audience: string;

  @ApiProperty({
    example: 'repo:acme/platform:ref:refs/heads/main',
    description:
      'The subject the workload’s token must carry; * stands for any run of characters',
  })
  readonly subject: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { repository: 'acme/platform', ref: 'refs/heads/main' },
    description:
      'Further claims the workload’s token must carry, each matching its pattern the way subject does',
  })
  readonly claims: Readonly<Record<string, string>>;

  @ApiProperty({
    enum: TOKEN_SCOPES,
    isArray: true,
    example: ['configure', 'secrets'],
    description: 'The scopes every token it mints is given',
  })
  readonly scopes: readonly string[];

  @ApiProperty({
    type: 'integer',
    example: 15,
    minimum: 1,
    maximum: 60,
    description: 'How many minutes a token it mints admits its bearer',
  })
  readonly lifetimeMinutes: number;

  @ApiProperty({
    example: 'kR3vUzPq9sY2mB8nT1wXcA',
    description:
      'The person who defined the trust, or who issued the token that did; the tokens it mints act on their behalf',
  })
  readonly definedBy: string;

  constructor(trust: WorkspaceTokenTrustResourceDto) {
    super(trust);
    this.workspaceId = trust.workspaceId;
    this.key = trust.key;
    this.issuer = trust.issuer;
    this.audience = trust.audience;
    this.subject = trust.subject;
    this.claims = trust.claims;
    this.scopes = trust.scopes;
    this.lifetimeMinutes = trust.lifetimeMinutes;
    this.definedBy = trust.definedBy;
  }
}
