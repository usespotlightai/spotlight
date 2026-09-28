import type { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';

export const carriesRunTokens = (
  url: ProvisionUrl,
  insecureAllowed: boolean,
): boolean => url.isSecure || insecureAllowed;
