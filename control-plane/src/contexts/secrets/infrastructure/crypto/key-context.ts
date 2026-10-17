import type { KeyContext } from '@secrets/infrastructure/kms/key-management';

export const aadFor = (context: KeyContext): string =>
  JSON.stringify(
    Object.keys(context)
      .sort()
      .map((key) => [key, context[key]]),
  );
