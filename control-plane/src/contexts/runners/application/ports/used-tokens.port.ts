import type {
  TokenHolder,
  TokenHolderKind,
} from '@runners/domain/value-objects/token-holder.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export interface UsedTokensPort {
  wasUsed(kind: TokenHolderKind, token: TokenHash): Promise<boolean>;

  // Returns false when the token is already recorded for this kind of holder: the unique (kind, token) key is the only backstop against reuse.
  record(token: TokenHash, holder: TokenHolder): Promise<boolean>;
}
