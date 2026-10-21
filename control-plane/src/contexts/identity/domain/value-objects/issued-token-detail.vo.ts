import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { OidcTrustId } from '@shared-kernel/domain/value-objects/oidc-trust-id.vo';

export class IssuedTokenDetail implements ChangeDetail {
  private constructor(
    readonly issuedByTrustId: string,
    readonly subject: string,
    readonly scopes: readonly string[],
    readonly expiresAt: string,
  ) {}

  static of(issued: {
    issuedByTrustId: OidcTrustId;
    subject: string;
    scopes: readonly string[];
    expiresAt: Date;
  }): IssuedTokenDetail {
    return new IssuedTokenDetail(
      issued.issuedByTrustId.value,
      issued.subject,
      [...issued.scopes],
      issued.expiresAt.toISOString(),
    );
  }

  recorded(): RecordedDetail {
    return {
      trust: this.issuedByTrustId,
      subject: this.subject,
      scopes: this.scopes,
      expiresAt: this.expiresAt,
    };
  }
}
