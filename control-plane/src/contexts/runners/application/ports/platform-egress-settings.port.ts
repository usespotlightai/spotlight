import type { EgressUrl } from '@runners/domain/value-objects/egress-url.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export interface PlatformEgressSettings {
  readonly url: EgressUrl;
  readonly tokenHash: TokenHash;
}
