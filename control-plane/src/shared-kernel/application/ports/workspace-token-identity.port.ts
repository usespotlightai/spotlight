import type { TokenPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';

export const WORKSPACE_TOKEN_IDENTITY = Symbol('WORKSPACE_TOKEN_IDENTITY');

export interface WorkspaceTokenIdentityPort {
  identify(bearer: string): Promise<TokenPrincipal | null>;
}
