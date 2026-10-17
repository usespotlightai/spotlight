import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export const sameHash = (one: TokenHash, other: TokenHash): boolean => {
  let differs = one.value.length ^ other.value.length;

  for (let at = 0; at < one.value.length; at++) {
    differs |= one.value.charCodeAt(at) ^ other.value.charCodeAt(at);
  }

  return differs === 0;
};
