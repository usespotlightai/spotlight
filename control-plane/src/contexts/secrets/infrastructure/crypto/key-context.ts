import type { KeyContext } from '@secrets/infrastructure/kms/key-management';

export const boundTo = (context: KeyContext): string =>
  JSON.stringify(
    Object.keys(context)
      .sort()
      .map((key) => [key, context[key]]),
  );
