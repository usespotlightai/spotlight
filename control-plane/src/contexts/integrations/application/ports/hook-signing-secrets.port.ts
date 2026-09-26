import type { HookSigningSecret } from '@integrations/domain/value-objects/hook-signing-secret.vo';

export const HOOK_SIGNING_SECRETS = Symbol('HOOK_SIGNING_SECRETS');

export interface HookSigningSecretsPort {
  signingSecretOf(hookId: string): Promise<HookSigningSecret | null>;
}
