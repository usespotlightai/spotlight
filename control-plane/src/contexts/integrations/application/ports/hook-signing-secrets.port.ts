import type { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import type { SigningSecret } from '@shared-kernel/domain/value-objects/signing-secret.vo';

export const HOOK_SIGNING_SECRETS = Symbol('HOOK_SIGNING_SECRETS');

export interface HookSigningSecretsPort {
  signingSecretOf(hookId: HookDefinitionId): Promise<SigningSecret | null>;
}
