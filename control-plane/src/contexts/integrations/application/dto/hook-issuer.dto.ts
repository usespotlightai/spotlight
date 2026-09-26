import type { PublishedKeys } from '@integrations/application/ports/hook-tokens.port';

export interface HookIssuerDto {
  readonly issuer: string;
  readonly keys: PublishedKeys;
}
