import type { OidcTrustSummaryDto } from '@identity/application/dto/oidc-trust-summary.dto';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const OIDC_TRUST_READER = Symbol('OIDC_TRUST_READER');

export interface OidcTrustReaderPort {
  listIn(workspaceId: WorkspaceId): Promise<OidcTrustSummaryDto[]>;
}
