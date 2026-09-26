import { distinct } from '@shared-kernel/domain/services/distinct';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export interface WornByEgress {
  readonly env: Readonly<Record<string, string>>;
  readonly wears: readonly SecretName[];
}

const placeholderFor = (secret: SecretName): string =>
  `spotlight-egress:${secret.value}`;

export const wornByEgress = (
  env: Readonly<Record<string, string>>,
): WornByEgress => {
  const wears: SecretName[] = [];

  const written = Object.fromEntries(
    Object.entries(env).map(([name, value]) => {
      const secret = SecretName.referencedBy(value);

      if (!secret) {
        return [name, value];
      }

      wears.push(secret);
      return [name, placeholderFor(secret)];
    }),
  );

  return {
    env: written,
    wears: distinct(wears),
  };
};
