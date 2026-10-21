import type { OidcTrustSummaryDto } from '@identity/application/dto/oidc-trust-summary.dto';
import { ApiProperty } from '@nestjs/swagger';
import {
  TOKEN_SCOPES,
  type TokenScopeName,
} from '@shared-kernel/domain/value-objects/token-scope.vo';

export class OidcTrustCreatorResponseDto {
  @ApiProperty({ example: 'user_1' })
  readonly id: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Ada Lovelace',
    description: 'Null when the account no longer exists',
  })
  readonly name: string | null;

  constructor(creator: OidcTrustSummaryDto['createdBy']) {
    this.id = creator.id;
    this.name = creator.name;
  }
}

export class OidcTrustSummaryResponseDto {
  @ApiProperty({ example: '0d6f3c1e-8a52-4f7b-9c1d-5e2a7b3f9c40' })
  readonly id: string;

  @ApiProperty({ example: 'github-main' })
  readonly key: string;

  @ApiProperty({ example: 'https://token.actions.githubusercontent.com' })
  readonly issuer: string;

  @ApiProperty({ example: 'spotlight' })
  readonly audience: string;

  @ApiProperty({
    example: 'repo:acme/platform:ref:refs/heads/main',
    description:
      'The subject a workload’s token must carry. * matches any run of characters',
  })
  readonly subject: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { repository_owner: 'acme' },
    description: 'Further claims the workload’s token must carry, by name',
  })
  readonly claims: Readonly<Record<string, string>>;

  @ApiProperty({
    enum: TOKEN_SCOPES,
    isArray: true,
    example: ['configure', 'secrets'],
    description: 'The scopes of every token the trust issues',
  })
  readonly scopes: readonly TokenScopeName[];

  @ApiProperty({ example: 15 })
  readonly lifetimeMinutes: number;

  @ApiProperty({
    type: OidcTrustCreatorResponseDto,
    description: 'The person who created the trust. Its tokens act for them',
  })
  readonly createdBy: OidcTrustCreatorResponseDto;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'When the trust was created',
  })
  readonly createdAt: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When the trust last issued a token. Null when it never did',
  })
  readonly lastIssuedAt: string | null;

  constructor(trust: OidcTrustSummaryDto) {
    this.id = trust.id;
    this.key = trust.key;
    this.issuer = trust.issuer;
    this.audience = trust.audience;
    this.subject = trust.subject;
    this.claims = trust.claims;
    this.scopes = trust.scopes;
    this.lifetimeMinutes = trust.lifetimeMinutes;
    this.createdBy = new OidcTrustCreatorResponseDto(trust.createdBy);
    this.createdAt = trust.createdAt.toISOString();
    this.lastIssuedAt = trust.lastIssuedAt?.toISOString() ?? null;
  }
}
