import type { TokenScopeName } from '@shared-kernel/domain/value-objects/token-scope.vo';

export interface OidcTrustSummaryDto {
  readonly id: string;
  readonly key: string;
  readonly issuer: string;
  readonly audience: string;
  readonly subject: string;
  readonly claims: Readonly<Record<string, string>>;
  readonly scopes: readonly TokenScopeName[];
  readonly lifetimeMinutes: number;
  readonly createdBy: { readonly id: string; readonly name: string | null };
  readonly createdAt: Date;
  readonly lastIssuedAt: Date | null;
}
