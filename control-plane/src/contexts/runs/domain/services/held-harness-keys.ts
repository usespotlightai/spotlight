import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export const heldHarnessKeys = (
  harnessKeys: readonly string[],
  held: readonly string[],
): SecretName[] => {
  const holding = new Set(held);

  return [...new Set(harnessKeys)]
    .filter((each) => holding.has(each))
    .sort()
    .map((each) => SecretName.of(each));
};
