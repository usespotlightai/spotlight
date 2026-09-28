import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';

export class MintedTokenDetail implements ChangeDetail {
  private constructor(
    readonly mintedThrough: string,
    readonly subject: string,
    readonly scopes: readonly string[],
    readonly expiresAt: string,
  ) {}

  static of(minted: {
    mintedThrough: WorkspaceTokenTrustId;
    subject: string;
    scopes: readonly string[];
    expiresAt: Date;
  }): MintedTokenDetail {
    return new MintedTokenDetail(
      minted.mintedThrough.value,
      minted.subject,
      [...minted.scopes],
      minted.expiresAt.toISOString(),
    );
  }

  recorded(): RecordedDetail {
    return {
      trust: this.mintedThrough,
      subject: this.subject,
      scopes: this.scopes,
      expiresAt: this.expiresAt,
    };
  }
}
