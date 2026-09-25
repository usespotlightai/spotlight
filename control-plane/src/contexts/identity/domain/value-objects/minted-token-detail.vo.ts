import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';

export class MintedTokenDetail implements ChangeDetail {
  private constructor(
    readonly trustId: string,
    readonly subject: string,
    readonly scopes: readonly string[],
    readonly expiresAt: string,
  ) {}

  static of(minted: {
    trustId: WorkspaceTokenTrustId;
    subject: string;
    scopes: readonly string[];
    expiresAt: Date;
  }): MintedTokenDetail {
    return new MintedTokenDetail(
      minted.trustId.value,
      minted.subject,
      [...minted.scopes],
      minted.expiresAt.toISOString(),
    );
  }

  recorded(): RecordedDetail {
    return {
      trust: this.trustId,
      subject: this.subject,
      scopes: this.scopes,
      expiresAt: this.expiresAt,
    };
  }
}
